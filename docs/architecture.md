# ContribHub Architecture

## 1. Modular Monolith Design

ContribHub is structured as a single deployable modular monolith using **TanStack Start + Nitro** with strict layering:

- **`src/routes/` & `src/components/` (Presentation)**: Client & SSR React components, TanStack Router routes, TanStack Query cache, and optimistic UI. Never imports `src/db/*` or `src/server/*` directly.
- **`src/server/functions/` & `src/routes/api/v1/` (Transport)**:
  - `createServerFn` handlers validate input with Zod (`src/shared/schemas/`) and verify the session with `requireSession()`.
  - `/api/v1/*` REST routes share the exact same Domain Services and accept either Better Auth session cookies or hashed `Authorization: Bearer ch_...` API tokens (designed for the future browser extension).
- **`src/server/services/` (Domain Services)**: Pure server-side business logic (`repository.service.ts`, `contribution.service.ts`, `research.service.ts`, `tag.service.ts`, `search.service.ts`, `history.service.ts`, `github.service.ts`, `preferences.service.ts`). All multi-step mutations execute inside PostgreSQL transactions and append immutable `contribution_events`.
- **`src/db/` (Persistence)**: Drizzle ORM schema (`src/db/schema/*`), PostgreSQL `postgres` driver (`prepare: false` for serverless pooler compatibility), and versioned SQL migrations (`drizzle/`).
- **`src/shared/` (Isomorphic Contracts)**: Zod validation schemas, domain enums/constants, and the deterministic GitHub URL parser (`github-url.ts`).

## 2. Database Design Highlights

1. **Canonical Repositories + User Library Split**:
   - `repositories` stores shared GitHub metadata keyed by immutable `github_repository_id` (`BIGINT UNIQUE`) and `normalized_full_name` (`UNIQUE`).
   - When an upstream repository is renamed or transferred, syncing looks up `github_repository_id` first and updates `owner`, `name`, `full_name`, and `url` in place—zero broken foreign keys or duplicate rows.
   - `user_repositories` (`UNIQUE (user_id, repository_id)`) isolates each user's personal notes, tracking status, and pinned state.
2. **Decoupled Personal vs. Upstream State**:
   - `contributions.personal_status` (`inbox` | `researching` | `ready` | `in_progress` | `pr_submitted` | `completed` | `abandoned`) is strictly controlled by the user.
   - `contributions.upstream_outcome` (`none` | `open_pr` | `merged` | `closed_unmerged` | `accepted_externally`) and `github_references.external_status` (`open` | `closed` | `merged` | `unknown`) track upstream reality independently.
3. **Separated GitHub Syncable Refs vs. Technical Resources**:
   - `github_references` holds syncable GitHub entities (`issue`, `pull_request`, `discussion`, `commit`) with `etag`, `merged_at`, `closed_at`, and `UNIQUE (contribution_id, normalized_url)`.
   - `contribution_resources` holds non-synced technical references (`documentation`, `source_file`, `discussion`, `external_url`, `other`).
4. **Scalable Search**:
   - Migration `0001_search_indexes.sql` enables `pg_trgm` and creates GIN `to_tsvector` full-text indexes on `contributions` and `contribution_notes` plus trigram indexes on titles, repository names, and GitHub reference titles.

## 3. Security Model

- **Authentication**: Better Auth with Drizzle PostgreSQL adapter and `tanstackStartCookies()` plugin (HTTP-only cookies).
- **Authorization & Multi-Tenant Isolation**: Every server function derives `userId` exclusively from `requireSession()`. Every DB read/write scopes queries by `eq(table.userId, userId)` or joins ownership through `contributions.userId`.
- **Encrypted GitHub Token Vault**: Upon GitHub OAuth sign-in or account link, Better Auth's `databaseHooks.account` encrypts the OAuth access token using **AES-256-GCM** (`GITHUB_TOKEN_ENCRYPTION_KEY`) into `github_accounts` (`encrypted_access_token`, `token_iv`, `token_auth_tag`, `key_version`) and clears the raw token from `account`. Decrypted tokens are never returned to the client or logged.
- **API Tokens**: Extension/CLI tokens (`ch_...`) are displayed once on creation and persisted only as SHA-256 hashes in `api_tokens`.

## 4. GitHub Integration & Sync Semantics

- **Least Privilege**: Requests only `read:user user:email`, providing 5,000 requests/hour for all public repos/issues/PRs without write access.
- **Public Fallback**: Works unauthenticated (60 req/hr) when GitHub is not connected.
- **ETag Conditional Caching**: Persists HTTP `ETag` headers on `repositories` and `github_references` and sends `If-None-Match` on sync; `304 Not Modified` responses consume zero GitHub rate-limit quota.
- **Rate-Limit Awareness**: Captures `x-ratelimit-remaining` and `x-ratelimit-reset` on every call, persists them on `github_accounts`, and surfaces typed `RateLimitError` messages with exact reset times.
- **Status Safety**:
  - Closing an upstream issue updates `github_references.external_status = 'closed'` only—it never marks `personal_status = 'completed'`.
  - Merging an upstream PR sets `upstream_outcome = 'merged'` and surfaces a non-intrusive completion suggestion banner in the UI while preserving user control.
  - Closing a PR without merging sets `upstream_outcome = 'closed_unmerged'` so History never misclassifies rejected/closed PRs as accepted.

## 5. Future Extensibility

- **Webhooks & Scheduled Sync**: `syncRepositoryMetadata` and `syncGithubReference` in `src/server/services/github.service.ts` are idempotent and directly callable from future Vercel Cron jobs or GitHub App webhook routes.
- **Browser Extension**: `/api/v1/contributions`, `/api/v1/contributions/:id`, and `/api/v1/repositories` are already live with Bearer token authentication and duplicate URL detection.
- **AI Assistance**: Research Workspace fields (`description`, `proposed_solution`, `reproduction_steps`, `contribution_notes`) are structured cleanly to feed future read-only issue summarization or planning assistants without autonomous upstream mutations.
