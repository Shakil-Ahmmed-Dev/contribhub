import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { Octokit } from '@octokit/rest'
import * as schema from '#/db/schema'
import {
  addRepositoryForUser,
  getRepositoryDetail,
  listUserRepositories,
  syncRepositoryMetadata,
} from '#/server/services/repository.service'
import {
  createContribution,
  deleteContribution,
  findDuplicateContributionsByUrl,
  getContributionDetail,
  listContributions,
  moveContributionStatus,
  updateContribution,
} from '#/server/services/contribution.service'
import {
  createChecklistItem,
  createNote,
  createResource,
  updateChecklistItem,
} from '#/server/services/research.service'
import { createTag } from '#/server/services/tag.service'
import { globalSearch } from '#/server/services/search.service'
import { getContributionHistory } from '#/server/services/history.service'
import {
  linkGithubReference,
  syncGithubReference
  
} from '#/server/services/github.service'
import type {OctokitFactory} from '#/server/services/github.service';
import { ConflictError, NotFoundError, RateLimitError } from '#/server/errors'

const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://contribhub:contribhub_dev@localhost:5432/contribhub_test'

let client: postgres.Sql
let testDb: ReturnType<typeof drizzle<typeof schema>>

const USER_A = 'test-user-a'
const USER_B = 'test-user-b'

function createMockOctokitFactory(overrides: {
  getRepo?: () => Promise<unknown>
  getIssue?: () => Promise<unknown>
  getPull?: () => Promise<unknown>
}): OctokitFactory {
  return {
    create: () =>
      ({
        rest: {
          repos: {
            get: overrides.getRepo ?? (async () => {
              throw Object.assign(new Error('Not mocked'), { status: 500 })
            }),
          },
          issues: {
            get: overrides.getIssue ?? (async () => {
              throw Object.assign(new Error('Not mocked'), { status: 500 })
            }),
          },
          pulls: {
            get: overrides.getPull ?? (async () => {
              throw Object.assign(new Error('Not mocked'), { status: 500 })
            }),
          },
        },
      }) as unknown as Octokit,
  }
}

describe('ContribHub PostgreSQL Integration Suite', () => {
  beforeAll(async () => {
    client = postgres(testDbUrl, { max: 4, prepare: false })
    testDb = drizzle(client, { schema })
    await migrate(testDb, { migrationsFolder: './drizzle' })
  })

  beforeEach(async () => {
    await client`
      TRUNCATE TABLE
        contribution_events,
        contribution_tags,
        contribution_checklists,
        contribution_notes,
        contribution_resources,
        github_references,
        contributions,
        user_repositories,
        repositories,
        tags,
        github_accounts,
        user_preferences,
        api_tokens,
        session,
        account,
        verification,
        "user"
      RESTART IDENTITY CASCADE
    `

    await testDb.insert(schema.user).values([
      { id: USER_A, name: 'Alice OSS', email: 'alice@example.com' },
      { id: USER_B, name: 'Bob OSS', email: 'bob@example.com' },
    ])
  })

  afterAll(async () => {
    await client.end()
  })

  it('tracks non-owned public repositories, prevents duplicates, and handles repo renames via immutable githubRepositoryId', async () => {
    let repoName = 'router'
    const mockFactory = createMockOctokitFactory({
      getRepo: async () => ({
        headers: { etag: 'W/"repo-etag-1"' },
        data: {
          id: 555001,
          owner: { login: 'TanStack' },
          name: repoName,
          full_name: `TanStack/${repoName}`,
          description: 'Type-safe router for React',
          html_url: `https://github.com/TanStack/${repoName}`,
          language: 'TypeScript',
          default_branch: 'main',
          stargazers_count: 12000,
          forks_count: 900,
          visibility: 'public',
          archived: false,
        },
      }),
    })

    const first = await addRepositoryForUser(
      USER_A,
      { identifier: 'https://github.com/TanStack/router' },
      { database: testDb, octokitFactory: mockFactory },
    )
    expect(first.alreadyTracked).toBe(false)
    expect(first.repository.githubRepositoryId).toBe(555001)
    expect(first.repository.fullName).toBe('TanStack/router')

    // Adding again must NOT create duplicate canonical or user_repositories records
    const duplicate = await addRepositoryForUser(
      USER_A,
      { identifier: 'tanstack/router' },
      { database: testDb, octokitFactory: mockFactory },
    )
    expect(duplicate.alreadyTracked).toBe(true)
    expect(duplicate.repository.id).toBe(first.repository.id)

    // Simulate upstream rename on GitHub while keeping immutable githubRepositoryId 555001
    repoName = 'router-next'
    const synced = await syncRepositoryMetadata(USER_A, first.repository.id, {
      database: testDb,
      octokitFactory: mockFactory,
    })
    expect(synced.changed).toBe(true)
    expect(synced.repository.id).toBe(first.repository.id)
    expect(synced.repository.fullName).toBe('TanStack/router-next')

    const userAList = await listUserRepositories(USER_A, {}, testDb)
    expect(userAList).toHaveLength(1)
  })

  it('creates contributions without an existing GitHub issue and enforces strict user isolation', async () => {
    const repoRes = await addRepositoryForUser(
      USER_A,
      { identifier: 'vitejs/vite', skipGithubLookup: true },
      { database: testDb },
    )

    // Issueless independent feature idea
    const contrib = await createContribution(
      USER_A,
      {
        title: 'Add better error message when plugin returns null',
        description: 'Spotted while debugging a custom Vite plugin.',
        proposedSolution: 'Validate plugin hook return value and log plugin name.',
        repositoryId: repoRes.repository.id,
        contributionType: 'feature_idea',
        priority: 'high',
        estimatedEffort: 's',
      },
      { database: testDb, skipGithubLookup: true },
    )

    expect(contrib.personalStatus).toBe('inbox')
    expect(contrib.repositoryId).toBe(repoRes.repository.id)

    const detail = await getContributionDetail(USER_A, contrib.id, testDb)
    expect(detail.githubReferences).toHaveLength(0)
    expect(detail.events).toHaveLength(1)
    expect(detail.events[0].eventType).toBe('created')

    // User B must be completely isolated from User A's records
    await expect(
      getContributionDetail(USER_B, contrib.id, testDb),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      updateContribution(USER_B, { id: contrib.id, title: 'Hacked' }, testDb),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      deleteContribution(USER_B, contrib.id, testDb),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      getRepositoryDetail(USER_B, repoRes.repository.id, testDb),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      createNote(
        USER_B,
        { contributionId: contrib.id, content: 'Unauthorized note' },
        testDb,
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('supports status transitions, research notes, checklists, filtering, and global search', async () => {
    const tag = await createTag(USER_A, { name: 'performance', color: '#10b981' }, testDb)
    const repo = await addRepositoryForUser(
      USER_A,
      { identifier: 'drizzle-team/drizzle-orm', skipGithubLookup: true },
      { database: testDb },
    )

    const contrib = await createContribution(
      USER_A,
      {
        title: 'Optimize SQL query builder string concatenation',
        description: 'Avoid repeated array allocations in hot path.',
        repositoryId: repo.repository.id,
        contributionType: 'performance',
        priority: 'urgent',
        tagIds: [tag.id],
      },
      { database: testDb, skipGithubLookup: true },
    )

    // Transition Inbox -> Researching -> Ready -> Completed
    await moveContributionStatus(
      USER_A,
      { id: contrib.id, personalStatus: 'researching' },
      testDb,
    )
    await createNote(
      USER_A,
      {
        contributionId: contrib.id,
        title: 'Profiler findings',
        content: 'Flamegraph shows `buildQueryChunks` taking 14% CPU time.',
        contentType: 'investigation',
      },
      testDb,
    )
    await createNote(
      USER_A,
      {
        contributionId: contrib.id,
        title: 'Benchmark snippet',
        content: 'const out: string[] = [];',
        contentType: 'code_snippet',
        codeLanguage: 'typescript',
      },
      testDb,
    )
    const task = await createChecklistItem(
      USER_A,
      { contributionId: contrib.id, title: 'Run vitest benchmarks' },
      testDb,
    )
    await updateChecklistItem(
      USER_A,
      { id: task.id, isCompleted: true },
      testDb,
    )
    await createResource(
      USER_A,
      {
        contributionId: contrib.id,
        resourceType: 'source_file',
        title: 'SQL builder core',
        urlOrPath: 'drizzle-orm/src/sql/sql.ts:L120',
      },
      testDb,
    )

    // Filtering by tag, priority, and status
    const filtered = await listContributions(
      USER_A,
      {
        statuses: ['researching'],
        priorities: ['urgent'],
        tagIds: [tag.id],
      },
      testDb,
    )
    expect(filtered.items).toHaveLength(1)
    expect(filtered.items[0].checklistSummary).toEqual({
      total: 1,
      completed: 1,
    })

    // Global search matches across title, notes, and repository name
    const searchByNote = await globalSearch(USER_A, 'buildQueryChunks', testDb)
    expect(searchByNote.notes).toHaveLength(1)
    expect(searchByNote.contributions).toHaveLength(0)

    const searchByRepo = await globalSearch(USER_A, 'drizzle-orm', testDb)
    expect(searchByRepo.repositories).toHaveLength(1)
    expect(searchByRepo.contributions).toHaveLength(1)

    // Complete personally (independent work)
    const completed = await moveContributionStatus(
      USER_A,
      { id: contrib.id, personalStatus: 'completed' },
      testDb,
    )
    expect(completed.personalCompletedAt).toBeInstanceOf(Date)
  })

  it('keeps GitHub status decoupled from personalStatus, accurately classifies merged vs closed-unmerged PRs, and handles ETag 304 & rate limits', async () => {
    const repo = await addRepositoryForUser(
      USER_A,
      { identifier: 'facebook/react', skipGithubLookup: true },
      { database: testDb },
    )

    const issueContrib = await createContribution(
      USER_A,
      {
        title: 'Fix Suspense edge case',
        repositoryId: repo.repository.id,
        personalStatus: 'in_progress',
      },
      { database: testDb, skipGithubLookup: true },
    )

    // 1. Link an open issue, then sync when it becomes closed on GitHub
    let issueState: 'open' | 'closed' = 'open'
    let return304 = false
    let simulateRateLimit = false

    const issueFactory = createMockOctokitFactory({
      getIssue: async () => {
        if (simulateRateLimit) {
          throw Object.assign(new Error('API rate limit exceeded'), {
            status: 403,
            response: {
              headers: {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600),
              },
            },
          })
        }
        if (return304) {
          throw Object.assign(new Error('Not Modified'), { status: 304 })
        }
        return {
          headers: { etag: 'W/"issue-etag-1"' },
          data: {
            id: 9001,
            number: 123,
            html_url: 'https://github.com/facebook/react/issues/123',
            title: 'Suspense fallback flickers',
            state: issueState,
            closed_at: issueState === 'closed' ? new Date().toISOString() : null,
          },
        }
      },
    })

    const issueRef = await linkGithubReference(
      USER_A,
      {
        contributionId: issueContrib.id,
        url: 'https://github.com/facebook/react/issues/123',
      },
      { database: testDb, octokitFactory: issueFactory },
    )
    expect(issueRef.externalStatus).toBe('open')

    // Duplicate link on same contribution must throw ConflictError
    await expect(
      linkGithubReference(
        USER_A,
        {
          contributionId: issueContrib.id,
          url: 'https://github.com/FACEBOOK/REACT/issues/123/',
        },
        { database: testDb, octokitFactory: issueFactory },
      ),
    ).rejects.toBeInstanceOf(ConflictError)

    // Duplicate URL lookup finds it
    const dupes = await findDuplicateContributionsByUrl(
      USER_A,
      'https://github.com/facebook/react/issues/123',
      testDb,
    )
    expect(dupes).toHaveLength(1)

    // ETag 304 Not Modified succeeds with changed: false
    return304 = true
    const cachedSync = await syncGithubReference(USER_A, issueRef.id, {
      database: testDb,
      octokitFactory: issueFactory,
    })
    expect(cachedSync.changed).toBe(false)
    return304 = false

    // Issue becomes closed upstream -> MUST NOT auto-mark personalStatus as completed!
    issueState = 'closed'
    const closedIssueSync = await syncGithubReference(USER_A, issueRef.id, {
      database: testDb,
      octokitFactory: issueFactory,
    })
    expect(closedIssueSync.reference.externalStatus).toBe('closed')
    const afterIssueClose = await getContributionDetail(
      USER_A,
      issueContrib.id,
      testDb,
    )
    expect(afterIssueClose.contribution.personalStatus).toBe('in_progress')

    // Rate-limit handling throws typed RateLimitError
    simulateRateLimit = true
    await expect(
      syncGithubReference(USER_A, issueRef.id, {
        database: testDb,
        octokitFactory: issueFactory,
      }),
    ).rejects.toBeInstanceOf(RateLimitError)

    // 2. Merged PR suggests completion without overriding personalStatus
    let prMerged = false
    let prState: 'open' | 'closed' = 'open'
    const prFactory = createMockOctokitFactory({
      getPull: async () => ({
        headers: { etag: 'W/"pr-etag-1"' },
        data: {
          id: 8001,
          number: 456,
          html_url: 'https://github.com/facebook/react/pull/456',
          title: 'Fix Suspense flicker',
          state: prState,
          draft: false,
          merged: prMerged,
          merged_at: prMerged ? new Date().toISOString() : null,
          closed_at: prState === 'closed' ? new Date().toISOString() : null,
        },
      }),
    })

    const prRef = await linkGithubReference(
      USER_A,
      {
        contributionId: issueContrib.id,
        url: 'https://github.com/facebook/react/pull/456',
      },
      { database: testDb, octokitFactory: prFactory },
    )
    expect(prRef.externalStatus).toBe('open')

    prState = 'closed'
    prMerged = true
    const mergedSync = await syncGithubReference(USER_A, prRef.id, {
      database: testDb,
      octokitFactory: prFactory,
    })
    expect(mergedSync.reference.externalStatus).toBe('merged')
    expect(mergedSync.suggestPersonalCompletion).toBe(true)

    const afterMerge = await getContributionDetail(USER_A, issueContrib.id, testDb)
    expect(afterMerge.contribution.upstreamOutcome).toBe('merged')
    expect(afterMerge.contribution.personalStatus).toBe('in_progress') // Still under user control!
    expect(afterMerge.suggestCompletion).toBe(true)

    // 3. Closed-without-merge PR must NEVER be classified as accepted/merged
    const rejectedContrib = await createContribution(
      USER_A,
      {
        title: 'Experimental API refactor',
        repositoryId: repo.repository.id,
        personalStatus: 'pr_submitted',
      },
      { database: testDb, skipGithubLookup: true },
    )

    const closedUnmergedFactory = createMockOctokitFactory({
      getPull: async () => ({
        headers: {},
        data: {
          id: 8002,
          number: 789,
          html_url: 'https://github.com/facebook/react/pull/789',
          title: 'Experimental refactor',
          state: 'closed',
          draft: false,
          merged: false,
          merged_at: null,
          closed_at: new Date().toISOString(),
        },
      }),
    })

    await linkGithubReference(
      USER_A,
      {
        contributionId: rejectedContrib.id,
        url: 'https://github.com/facebook/react/pull/789',
      },
      { database: testDb, octokitFactory: closedUnmergedFactory },
    )

    const history = await getContributionHistory(USER_A, testDb)
    expect(history.summary.submittedPrs).toBe(2)
    expect(history.summary.mergedPrs).toBe(1)
    expect(history.summary.closedUnmergedPrs).toBe(1)
    expect(history.closedUnmergedPrs[0].reference.number).toBe(789)
    expect(history.mergedPrs[0].reference.number).toBe(456)
  })
})
