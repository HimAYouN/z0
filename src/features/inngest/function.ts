// src/inngest/functions.ts
import { prisma } from "@/lib/db";
import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { MessageRole, MessageType } from "@/generated/prisma/enums";
import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  gemini,
  openai,
} from "@inngest/agent-kit";

import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/lib/prompts";
import z from "zod";
import {
  agentOutputText,
  captureTaskSummary,
  connectSandbox,
  lastAssistantTextMessageContent,
} from "./utils";

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

    // const geminiModel = gemini({
    //   model: AI_Model_Version,

    //   apiKey: process.env.GOOGLE_API_KEY!,
    //   defaultParameters: {
    //     generationConfig: {
    //       temperature: 0,
    //       maxOutputTokens: 8192,
    //       thinkingConfig: { thinkingBudget: 0 },
    //     },
    //   },
    // } as Parameters<typeof gemini>[0]);


    const AI_Model = openai({
      model: "gpt-4.1",
      apiKey: process.env.OPENAI_API_KEY,
      defaultParameters: { temperature: 0.5 },
    });


    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: AI_Model,
      tools: [
        //Terminal
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step: toolStep }) => {
            return await toolStep?.run(`terminal-${command}`, async () => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandbox = await Sandbox.connect(sandboxId);

                const result = await sandbox.commands.run(command, {
                  onStdout: (data) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data) => {
                    buffers.stderr += data;
                  },
                });

                return result.stdout;
              } catch (error) {
                console.log(
                  `Command failed: ${error} \n stdout: ${buffers.stdout}\n stderr: ${buffers.stderr}`
                );

                return `Command failed: ${error} \n stdout: ${buffers.stdout}\n stderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        // 2. createOrUpdateFiles
        createTool({
          name: "createOrUpdateFile",
          description:
            "Create or update one file in the sandbox. Call this tool once per file with a relative path and full file contents.",
          parameters: z.object({
            path: z
              .string()
              .describe("Relative file path, e.g. app/page.tsx"),
            content: z.string().describe("Full contents of the file"),
          }),
          handler: async ({ path, content }, { step: toolStep, network }) => {
            const newFiles = await toolStep?.run(
              `create-or-update-file-${path}`,
              async () => {
                try {
                  const updatedFiles = network?.state?.data.files || {};

                  const sandbox = await Sandbox.connect(sandboxId);
                  await sandbox.files.write(path, content);
                  updatedFiles[path] = content;

                  return updatedFiles;
                } catch (error) {
                  return "Error" + error;
                }
              }
            );

            if (typeof newFiles === "object" && network) {
              network.state.data.files = newFiles;
            }
          },
        }),
        // 3. readFiles
        createTool({
          name: "readFiles",
          description: "Read files in the sandbox",

          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step: toolStep }) => {
            return await toolStep?.run(`read-files-${files.length}`, async () => {
              try {
                const sandbox = await Sandbox.connect(sandboxId);

                const contents = [];

                for (const file of files) {
                  const content = await sandbox.files.read(file);
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
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork({
      name: "code-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async({ network }) => {
        const summary = network.state.data.summary;

        if(summary){
          return;
        }

        return codeAgent;
      }

    });

    const result = await network.run(event.data.value, { state });
    // console.log(result)
    const { summary, files } = result.state.data;

    const makeTextAgent = (name: string, system: string) => createAgent({ name, system, model: AI_Model });

    const fragmentTitleGenerator = makeTextAgent("fragment-title-generator", FRAGMENT_TITLE_PROMPT);
    const responseGenerator = makeTextAgent("response-generator", RESPONSE_PROMPT);

    const [{ output: fragmentTitleOutput }, { output: responseOutput }] = await Promise.all([
      fragmentTitleGenerator.run(summary, { step }),
      responseGenerator.run(summary, { step })
    ]);

    const fragmentTitle = agentOutputText(fragmentTitleOutput, "Untitled");
    const responseText = agentOutputText(responseOutput, "Here you go");

    // console.log(files)

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;


    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await connectSandbox(sandboxId);
      return `http://${sandbox.getHost(3000)}`
    });

    await step.run("save-result", async () => {
      // console.log("ISERROR: " , isError)
      if (isError) {
        return prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again",
            role: MessageRole.ASSISTANT,
            type: MessageType.ERROR,
          },


        })
      };

      return prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: responseText,
          role: MessageRole.ASSISTANT,
          type: MessageType.RESULT,
          fragments: {
            create: {
              sandboxUrl,
              title: fragmentTitle,
              files
            }
          }
        }
      })
    });


    return {
      url: sandboxId,
      title: fragmentTitle,
      files,
      summary,
    };
  },
);
