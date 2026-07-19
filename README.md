# GitLens AI
## Github for Life 
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/9b0d7599-97d3-44a9-9a2d-e33bc1827bfb" />

**Understand any codebase like the engineer who built it.**

GitLens AI is a repository intelligence dashboard for importing a repository, analyzing its architecture and risks, visualizing relationships, simulating change impact, and asking natural language questions about the codebase with repository-aware chat.

## Key features

- Import public GitHub repositories or ZIP archives
- Analyze file structure, languages, frameworks, and inferred modules
- Visualize architecture, dependency graphs, and cyclic relationships
- Surface heuristic risks, unused modules, and security or quality issues
- Simulate change impact across code, APIs, and tests
- Ask the repository-specific AI assistant questions grounded in stored repo context
- Export summaries, architecture notes, and API documentation as Markdown

## Prerequisites

- Node.js 20 or newer
- Git installed and available on the command line
- An OpenAI API key for repository-aware chat

## Local development

1. Clone the repository.
2. Run `npm install`.
3. Duplicate `.env.example` to `.env.local`.
4. Add your OpenAI key to `.env.local`:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. Start the app locally:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` in your browser.

> Do not commit `.env.local` or any secret keys to source control.

## Environment variables

- `OPENAI_API_KEY` - required for the repository chat API route

The app will also attempt to read `OPENAI_API_KEY` from `.env.local`, `.env`, `.env.development`, `.env.production`, or `.env.example` if the value is not already set in the environment.

## Project structure

- `app/` - Next.js App Router routes, layout, pages, and API endpoints
- `features/` - UI components grouped by feature area
- `services/` - repository import, analysis, risk, impact, and context server logic
- `types/` - shared TypeScript domain models
- `lib/` - common utilities

## Chat & repository intelligence flow

- Repository data is imported and stored in a local context store
- The AI assistant uses repository summaries, module metadata, and file previews
- The chat endpoint at `app/api/chat/route.ts` translates user questions into OpenAI chat completions
- If the OpenAI key is missing or upstream fails, the app falls back to a repository-informed local answer

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build the app for production
- `npm run start` — run the production build locally
- `npm run lint` — run Next.js lint checks

## Deployment notes

This app is built for Node-compatible hosting such as Vercel or another platform that supports Next.js App Router apps.

For production, consider:

- Using durable persistence instead of the current in-memory/context-store adapter
- Adding authentication before allowing repository imports
- Moving large analysis or clone work into background jobs with timeouts and file size limits
- Securing API routes and limiting external access to sensitive endpoints

## Notes

- The current repository context store is process-local and intended for demo use.
- The app is designed to highlight repository architecture, dependency relationships, risk indicators, and chat-based repository exploration.
- Future improvements should include private repo support, authenticated workspaces, persistent storage, and more advanced analysis pipelines.
