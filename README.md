# z0

z0 is an AI-powered web application generator. Describe an application in natural language, then review the generated code and live sandbox preview in a project workspace.

## Features

- **AI-Powered Code Generation**: Describe your project in plain English and generate complete, functional web applications
- **Live Code Preview**: Execute and preview generated code in E2B sandboxes
- **Pre-Built Templates**: Quick-start with templates for common use cases:
  - Landing pages (SaaS, Product Launch, Waitlist, Portfolio)
  - Business tools (Contact Forms, Invoice Generators, Booking Calendars, CRM Dashboards)
  - Productivity apps (Todo Apps, Kanban Boards, Notes Apps, Habit Trackers)
  - Utilities (Calculators, Unit Converters, and more)
- **Project Management**: Organize multiple projects, view history, and manage generated code fragments
- **Authentication**: Sign in with Clerk
- **Project Persistence**: Save projects, conversations, and generated fragments with Prisma and PostgreSQL

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Next.js App Router and API routes, with Inngest for workflow orchestration
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **AI Integration**: Inngest Agent Kit with OpenAI
- **Code Execution**: E2B Code Interpreter and a configurable sandbox template
- **UI Components**: Radix UI, shadcn, Lucide icons

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Clerk application keys
- OpenAI API key
- E2B sandbox template ID

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd z0
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` with the variables required by the application:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
DATABASE_URL=postgresql://user:password@localhost/z0_db
OPENAI_API_KEY=your_openai_key
E2B_SANDBOX_TEMPLATE_ID=your_e2b_template_id
```

`DATABASE_URL` is used by Prisma 7 through [prisma.config.ts](prisma.config.ts). The Clerk keys protect authenticated routes, and the OpenAI and E2B values are needed to generate and preview applications.

4. Apply the database migrations:
```bash
npx prisma migrate dev
```

5. Start the Inngest development server in a second terminal so background generation functions can be invoked:
```bash
npx inngest-cli@latest dev
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The Inngest development UI is available at [http://localhost:8288](http://localhost:8288).

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── (auth)/         # Authentication pages
│   ├── (root)/         # Main app pages
│   │   ├── page.tsx    # Home/dashboard
│   │   └── projects/   # Project workspace
│   └── api/            # API routes
├── components/
│   ├── home/           # Home page components
│   ├── ui/             # shadcn/ui component library
│   └── providers/      # React context providers
├── features/
│   ├── auth/           # Authentication logic
│   ├── projects/       # Project management
│   └── inngest/        # AI agent workflows
├── lib/                # Utilities and database client
└── generated/          # Generated Prisma types
```

## Data Model

The application stores four related Prisma models:

- **User**: Clerk-linked user profile information
- **Project**: A user's project and its metadata
- **Message**: User prompts and assistant results or errors
- **Fragment**: Generated files, title, and sandbox URL for a result message

## Building and Deployment

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Development

- **Linting**: `npm run lint`
- **Type checking**: `npx tsc --noEmit`
- **Database Studio**: `npx prisma studio` (view and edit data)
- **Database Migrations**: `npx prisma migrate dev` (apply or create local migrations)

## License

This project is private. All rights reserved.

## Support

For questions or issues, please refer to the main project documentation or contact the development team.
