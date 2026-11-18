import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  contributionEvents,
  contributions,
  githubReferences,
  repositories,
  userRepositories,
} from '#/db/schema'
import { parseGithubUrl } from '#/shared/github-url'
import type { TrackingStatus } from '#/shared/constants'
import { NotFoundError, RateLimitError, ValidationError } from '../errors'
import {
  fetchPublicRepositoryMetadata
  
  
} from './github.service'
import type {GithubRepoMetadata, OctokitFactory} from './github.service';

/**
 * Upserts a canonical repository record safely by immutable `githubRepositoryId`
 * (or `normalizedFullName` when offline/unverified), handling renames without duplicating.
 */
export async function upsertCanonicalRepository(
  parsed: { owner: string; name: string; fullName: string; normalizedFullName: string; url: string },
  metadata: GithubRepoMetadata | null,
  database: Database = db,
) {
  const now = new Date()

  if (metadata) {
    // 1. Check by immutable githubRepositoryId first (handles repository renames/transfers!)
    const [byGithubId] = await database
      .select()
      .from(repositories)
      .where(eq(repositories.githubRepositoryId, metadata.githubRepositoryId))
      .limit(1)

    if (byGithubId) {
      const [updated] = await database
        .update(repositories)
        .set({
          owner: metadata.owner,
          name: metadata.name,
          fullName: metadata.fullName,
          normalizedFullName: metadata.normalizedFullName,
          description: metadata.description,
          url: metadata.url,
          language: metadata.language,
          defaultBranch: metadata.defaultBranch,
          stars: metadata.stars,
          forks: metadata.forks,
          visibility: metadata.visibility,
          isArchived: metadata.isArchived,
          etag: metadata.etag,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(repositories.id, byGithubId.id))
        .returning()
      return updated
    }

    // 2. Check by normalizedFullName (in case it was previously saved without githubRepositoryId)
    const [byFullName] = await database
      .select()
      .from(repositories)
      .where(eq(repositories.normalizedFullName, metadata.normalizedFullName))
      .limit(1)

    if (byFullName) {
      const [updated] = await database
        .update(repositories)
        .set({
          githubRepositoryId: metadata.githubRepositoryId,
          owner: metadata.owner,
          name: metadata.name,
          fullName: metadata.fullName,
          description: metadata.description,
          url: metadata.url,
          language: metadata.language,
          defaultBranch: metadata.defaultBranch,
          stars: metadata.stars,
          forks: metadata.forks,
          visibility: metadata.visibility,
          isArchived: metadata.isArchived,
          etag: metadata.etag,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(repositories.id, byFullName.id))
        .returning()
      return updated
    }

    const [inserted] = await database
      .insert(repositories)
      .values({
        githubRepositoryId: metadata.githubRepositoryId,
        owner: metadata.owner,
        name: metadata.name,
        fullName: metadata.fullName,
        normalizedFullName: metadata.normalizedFullName,
        description: metadata.description,
        url: metadata.url,
        language: metadata.language,
        defaultBranch: metadata.defaultBranch,
        stars: metadata.stars,
        forks: metadata.forks,
        visibility: metadata.visibility,
        isArchived: metadata.isArchived,
        etag: metadata.etag,
        lastSyncedAt: now,
      })
      .returning()
    return inserted
  }

  // Fallback without GitHub metadata (offline or skipGithubLookup)
  const [existing] = await database
    .select()
    .from(repositories)
    .where(eq(repositories.normalizedFullName, parsed.normalizedFullName))
    .limit(1)

  if (existing) return existing

  const [inserted] = await database
    .insert(repositories)
    .values({
      owner: parsed.owner,
      name: parsed.name,
      fullName: parsed.fullName,
      normalizedFullName: parsed.normalizedFullName,
      url: parsed.url,
      visibility: 'public',
    })
    .returning()

  return inserted
}

export async function addRepositoryForUser(
  userId: string,
  input: {
    identifier: string
    personalNotes?: string
    trackingStatus?: TrackingStatus
    skipGithubLookup?: boolean
  },
  options: { database?: Database; octokitFactory?: OctokitFactory } = {},
) {
  const database = options.database ?? db
  const parsed = parseGithubUrl(input.identifier)
  if (!parsed) {
    throw new ValidationError(
      'Enter a valid GitHub repository URL (https://github.com/owner/repo) or owner/repo identifier',
    )
  }

  let metadata: GithubRepoMetadata | null = null
  let syncWarning: string | null = null

  if (!input.skipGithubLookup) {
    try {
      const res = await fetchPublicRepositoryMetadata(parsed.owner, parsed.name, {
        userId,
        database,
        octokitFactory: options.octokitFactory,
      })
      if (!res.notModified) {
        metadata = res.data
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw err
      }
      if (err instanceof RateLimitError) {
        syncWarning = err.message
      } else {
        syncWarning =
          err instanceof Error
            ? `Saved repository locally, but GitHub metadata sync failed: ${err.message}`
            : 'Saved repository locally without live GitHub metadata.'
      }
    }
  }

  const repo = await upsertCanonicalRepository(parsed, metadata, database)

  const [existingLink] = await database
    .select()
    .from(userRepositories)
    .where(
      and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.repositoryId, repo.id),
      ),
    )
    .limit(1)

  if (existingLink) {
    return {
      repository: repo,
      userRepository: existingLink,
      alreadyTracked: true,
      syncWarning,
    }
  }

  const [userRepo] = await database
    .insert(userRepositories)
    .values({
      userId,
      repositoryId: repo.id,
      personalNotes: input.personalNotes ?? '',
      trackingStatus: input.trackingStatus ?? 'active',
    })
    .returning()

  return {
    repository: repo,
    userRepository: userRepo,
    alreadyTracked: false,
    syncWarning,
  }
}

export async function ensureUserTracksRepository(
  userId: string,
  repositoryId: string,
  database: Database = db,
) {
  await database
    .insert(userRepositories)
    .values({
      userId,
      repositoryId,
      trackingStatus: 'active',
    })
    .onConflictDoNothing({
      target: [userRepositories.userId, userRepositories.repositoryId],
    })
}

export async function listUserRepositories(
  userId: string,
  filters: {
    search?: string
    trackingStatus?: TrackingStatus
    language?: string
  } = {},
  database: Database = db,
) {
  const conditions = [eq(userRepositories.userId, userId)]
  if (filters.trackingStatus) {
    conditions.push(eq(userRepositories.trackingStatus, filters.trackingStatus))
  }
  if (filters.language) {
    conditions.push(eq(repositories.language, filters.language))
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim().toLowerCase()}%`
    conditions.push(
      sql`(lower(${repositories.fullName}) LIKE ${q} OR lower(coalesce(${repositories.description}, '')) LIKE ${q})`,
    )
  }

  const rows = await database
    .select({
      userRepository: userRepositories,
      repository: repositories,
      totalContributions: sql<number>`coalesce((
        SELECT count(*)::int FROM contributions c
        WHERE c.user_id = ${userId} AND c.repository_id = ${repositories.id}
      ), 0)`,
      activeContributions: sql<number>`coalesce((
        SELECT count(*)::int FROM contributions c
        WHERE c.user_id = ${userId}
          AND c.repository_id = ${repositories.id}
          AND c.personal_status IN ('inbox', 'researching', 'ready', 'in_progress', 'pr_submitted')
      ), 0)`,
      completedContributions: sql<number>`coalesce((
        SELECT count(*)::int FROM contributions c
        WHERE c.user_id = ${userId}
          AND c.repository_id = ${repositories.id}
          AND c.personal_status = 'completed'
      ), 0)`,
    })
    .from(userRepositories)
    .innerJoin(repositories, eq(userRepositories.repositoryId, repositories.id))
    .where(and(...conditions))
    .orderBy(desc(userRepositories.isPinned), desc(userRepositories.updatedAt))

  return rows
}

export async function getRepositoryDetail(
  userId: string,
  repositoryId: string,
  database: Database = db,
) {
  const [tracked] = await database
    .select({
      userRepository: userRepositories,
      repository: repositories,
    })
    .from(userRepositories)
    .innerJoin(repositories, eq(userRepositories.repositoryId, repositories.id))
    .where(
      and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.repositoryId, repositoryId),
      ),
    )
    .limit(1)

  if (!tracked) {
    throw new NotFoundError('Repository not found in your library')
  }

  const repoContributions = await database
    .select()
    .from(contributions)
    .where(
      and(
        eq(contributions.userId, userId),
        eq(contributions.repositoryId, repositoryId),
      ),
    )
    .orderBy(desc(contributions.updatedAt))

  const contribIds = repoContributions.map((c) => c.id)

  const refs =
    contribIds.length > 0
      ? await database
          .select()
          .from(githubReferences)
          .where(
            and(
              eq(githubReferences.userId, userId),
              inArray(githubReferences.contributionId, contribIds),
            ),
          )
          .orderBy(desc(githubReferences.updatedAt))
      : []

  const historyEvents =
    contribIds.length > 0
      ? await database
          .select()
          .from(contributionEvents)
          .where(
            and(
              eq(contributionEvents.userId, userId),
              inArray(contributionEvents.contributionId, contribIds),
            ),
          )
          .orderBy(desc(contributionEvents.createdAt))
          .limit(40)
      : []

  return {
    ...tracked,
    contributions: repoContributions,
    activeContributions: repoContributions.filter(
      (c) => c.personalStatus !== 'completed' && c.personalStatus !== 'abandoned',
    ),
    completedContributions: repoContributions.filter(
      (c) => c.personalStatus === 'completed',
    ),
    linkedIssues: refs.filter((r) => r.referenceType === 'issue'),
    linkedPullRequests: refs.filter((r) => r.referenceType === 'pull_request'),
    historyEvents,
  }
}

export async function updateUserRepository(
  userId: string,
  input: {
    repositoryId: string
    personalNotes?: string
    trackingStatus?: TrackingStatus
    isPinned?: boolean
  },
  database: Database = db,
) {
  const [updated] = await database
    .update(userRepositories)
    .set({
      ...(input.personalNotes !== undefined
        ? { personalNotes: input.personalNotes }
        : {}),
      ...(input.trackingStatus !== undefined
        ? { trackingStatus: input.trackingStatus }
        : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.repositoryId, input.repositoryId),
      ),
    )
    .returning()

  if (!updated) {
    throw new NotFoundError('Repository not found in your library')
  }

  return updated
}

export async function removeUserRepository(
  userId: string,
  repositoryId: string,
  database: Database = db,
) {
  const [deleted] = await database
    .delete(userRepositories)
    .where(
      and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.repositoryId, repositoryId),
      ),
    )
    .returning()

  if (!deleted) {
    throw new NotFoundError('Repository not found in your library')
  }
  return { deleted: true }
}

export async function syncRepositoryMetadata(
  userId: string,
  repositoryId: string,
  options: { database?: Database; octokitFactory?: OctokitFactory } = {},
) {
  const database = options.database ?? db
  const [tracked] = await database
    .select({
      repository: repositories,
    })
    .from(userRepositories)
    .innerJoin(repositories, eq(userRepositories.repositoryId, repositories.id))
    .where(
      and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.repositoryId, repositoryId),
      ),
    )
    .limit(1)

  if (!tracked) {
    throw new NotFoundError('Repository not found in your library')
  }

  const repo = tracked.repository
  const res = await fetchPublicRepositoryMetadata(repo.owner, repo.name, {
    userId,
    etag: repo.etag,
    database,
    octokitFactory: options.octokitFactory,
  })

  const now = new Date()
  if (res.notModified) {
    const [touched] = await database
      .update(repositories)
      .set({ lastSyncedAt: now })
      .where(eq(repositories.id, repo.id))
      .returning()
    return { repository: touched, changed: false }
  }

  const m = res.data
  const [updated] = await database
    .update(repositories)
    .set({
      githubRepositoryId: m.githubRepositoryId,
      owner: m.owner,
      name: m.name,
      fullName: m.fullName,
      normalizedFullName: m.normalizedFullName,
      description: m.description,
      url: m.url,
      language: m.language,
      defaultBranch: m.defaultBranch,
      stars: m.stars,
      forks: m.forks,
      visibility: m.visibility,
      isArchived: m.isArchived,
      etag: m.etag,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(repositories.id, repo.id))
    .returning()

  return { repository: updated, changed: true }
}
