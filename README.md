# ContribHub — Personal Open Source Contribution Manager

ContribHub is a developer-oriented personal workspace for collecting, researching, prioritizing, executing, and tracking open-source contribution opportunities across public GitHub repositories.

## Core Philosophy

1. **Capture first, investigate later** — log ideas and bugs in seconds before opening an upstream issue.
2. **No GitHub issue required** — track independently identified feature ideas, bugs, refactoring, docs, and performance opportunities.
3. **Track any public repository** — no ownership, fork, or collaborator permission required.
4. **Personal workflow independence** — personal statuses (`Inbox` → `Researching` → `Ready` → `In Progress` → `PR Submitted` → `Completed` / `Abandoned`) remain strictly decoupled from GitHub issue/PR statuses.
5. **Resume effortlessly** — dedicated Research Workspaces store problem descriptions, proposed solutions, reproduction steps, Markdown notes, code snippets, checklists, technical references, and full audit timelines.

## Modules Implemented

- **Dashboard (`/`)**: Actionable counts across every workflow stage, Ready-to-Work priority queue, recently updated opportunities, recently added repositories, and quick actions.
- **Contribution Inbox (`/inbox`)**: Inline rapid capture bar with optional repo auto-detection, duplicate URL detection, and one-click triage actions.
- **Contribution Backlog (`/backlog`)**:
  - Drag-and-drop **Kanban board** with persisted ordering across all 7 columns.
  - **Table view** (TanStack Table) with sorting, grouping, column visibility toggles, and pagination.
  - **Repository Grouping view** and **Priority view**.
  - Multi-facet filters (Repository, Status, Priority, Type, Tag, Search) with saved user preferences.
- **Repository Library (`/repositories` & `/repositories/$repoId`)**: Canonical GitHub repository catalog deduplicated by immutable `githubRepositoryId` (rename-safe), personal Markdown notes, tracking status, pin/unpin, metadata sync, linked issues/PRs, and repo history.
- **Research Workspace (`/contributions/$contributionId`)**: Markdown Problem Description, Proposed Solution, Reproduction Steps, Investigation Notes, syntax-labeled Code Snippets, Actionable Checklists, Technical References, linked GitHub Issues/PRs with manual ETag-aware sync, merged-PR completion suggestions, and Activity Timeline.
- **In Progress (`/in-progress`)** & **Pull Requests (`/pull-requests`)**: Focused active work view and side-by-side Personal vs. GitHub PR tracker.
- **Contribution History (`/history`)**: Explicitly distinguishes **Personal Completion** from **Upstream Acceptance (Merged PRs)** and never misclassifies closed-unmerged PRs as accepted.
- **Global Search & Command Palette (`Ctrl+K` / `Cmd+K`)**: PostgreSQL full-text (`tsvector`) + trigram (`pg_trgm`) search across titles, descriptions, repositories, notes, tags, and GitHub references.
- **Extension-Ready REST API (`/api/v1/*`)**: Authenticated via Better Auth session cookie or SHA-256-hashed Personal Access Tokens (`Authorization: Bearer ch_...`) created in Settings.

## Tech Stack

- **Frontend**: TanStack Start, React 19, TypeScript (strict), TanStack Router, TanStack Query, TanStack Table, Tailwind CSS v4, Radix UI / shadcn-style primitives, Lucide Icons, `@dnd-kit`, `cmdk`
- **Backend**: TanStack Start Server Functions (`createServerFn`), versioned REST API (`/api/v1/*`), Zod v4
- **Database**: PostgreSQL 17, Drizzle ORM (`drizzle-orm` + `postgres`), versioned SQL migrations
- **Auth & Security**: Better Auth (GitHub OAuth + Email/Password, `tanstackStartCookies`), AES-256-GCM encryption for GitHub access tokens, strict server-derived `userId` isolation
- **GitHub Integration**: Octokit (`@octokit/rest`), conditional HTTP ETag (`304 Not Modified`) caching, rate-limit header tracking
- **Deployment**: Nitro + Vercel-compatible serverless build

---

## Local Development Setup

### Prerequisites

- Node.js `>= 20`
- `pnpm` (`>= 10`)
- Docker Desktop (for local PostgreSQL 17) **or** an existing PostgreSQL database URL (e.g., Neon, Supabase, Vercel Postgres)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Generate cryptographic secrets for `BETTER_AUTH_SECRET` and `GITHUB_TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `TEST_DATABASE_URL` | Tests | Separate PostgreSQL database for Vitest integration tests |
| `BETTER_AUTH_SECRET` | Yes | Random 32+ byte secret used by Better Auth to sign sessions & encrypt OAuth tokens |
| `BETTER_AUTH_URL` | Yes | Public server origin (e.g. `http://localhost:3000` or `https://your-app.vercel.app`) |
| `VITE_APP_URL` | Yes | Public origin exposed to the browser auth client |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Yes | 64-character hex string (32 bytes) for AES-256-GCM encryption of GitHub tokens in `github_accounts` |
| `GITHUB_CLIENT_ID` | Optional* | GitHub OAuth App Client ID (*required for GitHub OAuth sign-in & 5,000 req/hr quota) |
| `GITHUB_CLIENT_SECRET` | Optional* | GitHub OAuth App Client Secret |

> Public repository, issue, and PR lookups work even without GitHub OAuth configured (using GitHub's unauthenticated 60 req/hr quota), and email/password authentication works out of the box.

### 3. Start Local PostgreSQL & Apply Migrations

```bash
docker compose up -d
pnpm db:migrate
```

Other Drizzle database scripts:

```bash
pnpm db:generate   # Generate new SQL migration from src/db/schema/*
pnpm db:migrate    # Apply pending migrations in ./drizzle
pnpm db:studio     # Open Drizzle Studio database explorer
```

### 4. Start the Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000), create an account on `/signup` (or sign in with GitHub), and start tracking repositories and contributions.

---

## GitHub OAuth App Setup

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set:
   - **Application name**: `ContribHub (Local)` (or your production name)
   - **Homepage URL**: `http://localhost:3000` (or your Vercel domain)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Copy the **Client ID** and generate a **Client Secret**, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`.
4. **Least-privilege scopes**: ContribHub requests only `read:user user:email`. This grants the full **5,000 requests/hour** API quota for reading any public repository, issue, or PR while requesting **zero write permissions**.

---

## Browser Extension API (`/api/v1/*`)

Generate a Personal Access Token (`ch_...`) under **Settings → API Tokens**, then send requests with `Authorization: Bearer ch_...`:

- `GET /api/v1/health` — Health check.
- `GET /api/v1/contributions?lookupUrl=<encoded-github-url>` — Duplicate check for the currently opened GitHub issue or PR.
- `POST /api/v1/contributions` — Quick-capture a GitHub URL with optional `title`, `contributionType`, `priority`, and `note`.
- `GET /api/v1/contributions/:id` & `PATCH /api/v1/contributions/:id` — Read or update an existing contribution.
- `GET /api/v1/repositories` & `POST /api/v1/repositories` — List or add a public GitHub repository.

---

## Testing & Verification

Ensure the test database exists (using local Docker PostgreSQL):

```bash
docker exec contribhub-postgres psql -U contribhub -d postgres -c "CREATE DATABASE contribhub_test;"
```

Run checks:

```bash
pnpm test        # Unit + PostgreSQL integration suite (Vitest)
pnpm typecheck   # Strict TypeScript checking (tsc --noEmit)
pnpm lint        # ESLint
pnpm build       # Production Vite + Nitro build
```

---

## Deploying to Vercel

ContribHub includes `vercel.json` (`"framework": "tanstack-start"`) and the Nitro Vite plugin, with `prepare: false` and serverless-safe connection pool limits in `src/db/index.ts`.

1. Provision a PostgreSQL database (e.g., Neon, Supabase, or Vercel Postgres) and run `DATABASE_URL=<prod-url> pnpm db:migrate`.
2. Import the repository in Vercel.
3. Configure all required environment variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `VITE_APP_URL`, `GITHUB_TOKEN_ENCRYPTION_KEY`, and optionally `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`).
4. Update your GitHub OAuth App callback URL to `https://<your-domain>/api/auth/callback/github`.
5. Deploy.

For deeper architectural details, see [docs/architecture.md](docs/architecture.md).
