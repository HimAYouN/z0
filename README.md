# z0 - AI-Powered Web Application Generator

An intelligent web application generator that uses AI to create full-featured web applications from natural language descriptions. Describe what you want to build, and z0 generates production-ready code with a live preview.

## Features

- **AI-Powered Code Generation**: Describe your project in plain English and let AI generate complete, functional web applications
- **Live Code Preview**: Execute and preview generated code in sandboxes powered by E2B
- **Pre-Built Templates**: Quick-start with templates for common use cases:
  - Landing pages (SaaS, Product Launch, Waitlist, Portfolio)
  - Business tools (Contact Forms, Invoice Generators, Booking Calendars, CRM Dashboards)
  - Productivity apps (Todo Apps, Kanban Boards, Notes Apps, Habit Trackers)
  - Utilities (Calculators, Unit Converters, and more)
- **Project Management**: Organize multiple projects, view history, and manage generated code fragments
- **Secure Authentication**: User authentication powered by Clerk
- **Database Persistence**: Save projects and generated code using Prisma with PostgreSQL

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes, Inngest for workflow orchestration
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **AI Integration**: Inngest Agent Kit with support for OpenAI and Gemini
- **Code Execution**: E2B Code Interpreter for sandboxed code execution
- **UI Components**: Radix UI, shadcn, Lucide icons

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Clerk API keys
- OpenAI or Gemini API key
- E2B API key (optional, for code execution)

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

3. Set up environment variables by creating a `.env.local` file with:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
DATABASE_URL=postgresql://user:password@localhost/z0_db
INNGEST_EVENT_KEY=your_inngest_key
OPENAI_API_KEY=your_openai_key
E2B_API_KEY=your_e2b_key
```

4. Set up the database:
```bash
npx prisma migrate dev
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

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

## Database Schema

The application uses three main models:

- **User**: Stores user profile information (via Clerk)
- **Project**: Represents a user's project with metadata
- **Message**: Conversation history (user prompts and AI responses)
- **Fragment**: Generated code artifacts with sandbox URLs and file contents

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
- **Database Studio**: `npx prisma studio` (view and edit data)
- **Database Migrations**: `npx prisma migrate dev` (create schema changes)

## License

This project is private. All rights reserved.

## Support

For questions or issues, please refer to the main project documentation or contact the development team.
