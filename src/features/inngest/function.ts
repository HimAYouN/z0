// src/inngest/functions.ts
import { prisma } from "@/lib/db";
import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { MessageRole, MessageType } from "@/generated/prisma/enums";
import { createAgent, createNetwork, createState, createTool, gemini } from "@inngest/agent-kit";

import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/lib/prompts";
import z  from "zod";
import { agentOutputText, AI_Model_Version, captureTaskSummary, connectSandbox } from "./utils";

export interface CodeAgentState {
  sandboxId: string;
  summary: string;
  files: Record<string, string>;
}

export const processTask = inngest.createFunction(
  { id: "process-task", triggers: { event: "app/task.created" } },
  async ({ event, step }) => {
    const result = await step.run("handle-task", async () => {
      return { processed: true, id: event.data.id };
    });

    await step.sleep("pause", "1s");

    return { message: `Task ${event.data.id} complete`, result };
  },
);

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent", triggers: { event: "code-agent/run" } },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create({
        template: process.env.E2B_SANDBOX_TEMPLATE_ID,
      });
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          orderBy: {
            createdAt: "asc",
          },
        });
        return messages.map((message) => ({
          type: "text" as const,
          role:
            message.role == MessageRole.ASSISTANT
              ? ("assistant" as const)
              : ("user" as const),
          content: message.content,
        }));
      },
    );

    const state = createState<CodeAgentState>(
      { sandboxId, summary: "", files: {} },
      { messages: previousMessages },
    );
    // console.log("GOOGLE_API_KEY: :",process.env.GOOGLE_API_KEY)

    const geminiModel = gemini({
      model: AI_Model_Version,

      apiKey: process.env.GOOGLE_API_KEY!,
      defaultParameters: {
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
    } as Parameters<typeof gemini>[0]);

    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: geminiModel,
      tools: [
        //Terminal
        createTool({
          name: "terminal",
          description: " Use the terminal to run  commands",
          parameters: z.object({ command: z.string() }),
          handler: async ({ command }, { step: toolStep, network }) => {
            return toolStep?.run(`terminal-${command}`, async () => {
              const buffers = { stdout: "", stderr: "" };
              try {
                const sandbox = await connectSandbox(
                  network.state.data.sandboxId,
                );

                const result = await sandbox.commands.run(command, {
                  onStdout(data) {
                    buffers.stdout += data;
                  },
                  onStderr(data) {
                    buffers.stderr += data;
                  },
                });
                return result.stdout;
              } catch (error) {
                return `Command failed: ${error}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        // 2. createOrUpdateFiles
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update one file in the sanbox. Call this tool once per file with a relative path and full file contents.",
          parameters: z.object({
            path: z.string().describe("Relative file path e.g app/page.tsx"),
            content: z.string().describe("Full content of the file")
          }),
          handler: async ({ path, content }, { step: toolStep, network }) => {
             return toolStep?.run(`create-or-update-file-${path}`, async()=>{
              try {
                const sandbox = await Sandbox.connect(network.state.data.sandboxId)

                await sandbox.files.write(path, content);
                network.state.data.files[path] = content;
                return `File ${path} created or updated`;

              } catch (error) {
                return `Failed to create or update file ${path}: ${error}`;
              }
             })
          },
        }),
        // 3. readFiles
        createTool({
          name: "readFiles",
          description: "Read files in the sandbox",

          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sanbox = await Sandbox.connect(sandboxId);

                const contents:any = [];
                console.log(contents)

                for (const file of files) {
                  const content = await sanbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (error) {
                return "Error" + error;
              }
            });
          },
        }),
      ],
      lifecycle:{
        onResponse: async({result, network})=>{
          captureTaskSummary(result, network);
          return result
        }
      }
    });
    const network = createNetwork({
      name: "code-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: ({network})=> network.state.data.summary ? undefined : codeAgent,

      
    });
    const result = await network.run(event.data.value, {state})

    const {summary, files} = result.state.data;

    const makeTextAgent  = (name: string, system: string)=> createAgent({name, system, model:geminiModel})

    const fragmentTitleGenerator = makeTextAgent("fragment-title-generator", FRAGMENT_TITLE_PROMPT)
    const responseGenerator = makeTextAgent("response-generator" , RESPONSE_PROMPT)

    const [{output: fragmentTitleOutput}, {output: responseOutput}] = await  Promise.all([
      fragmentTitleGenerator.run(summary, {step}),
      responseGenerator.run(summary, {step})
    ])

    const fragmentTitle = agentOutputText(fragmentTitleOutput, "Untitled");
    const responseText = agentOutputText(responseOutput, "Here you go");

    const isError = !summary || Object.keys(files).length === 0
    const sandboxUrl = await step.run("get-sandbox-url", async()=>{
      const sandbox = await connectSandbox(sandboxId)
      return `http://${sandbox.getHost(3000)}`
    })

    await step.run("save-result", async()=>{
      if(isError){
        return prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again",
            role: MessageRole.ASSISTANT,
            type: MessageType.ERROR
          }
        })
      }

      return prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: responseText,
          role: MessageRole.ASSISTANT,
          type: MessageType.RESULT,
          fragments: {
            create:{
              sandboxUrl,
              title: fragmentTitle,
              files
            }
          }
        }
      })
    })

    return {
      url: sandboxId, title: fragmentTitle, files, summary
    }
  },
);
