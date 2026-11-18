import { Octokit } from '@octokit/rest'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  contributionEvents,
  contributions,
  githubAccounts,
  githubReferences,
  repositories,
} from '#/db/schema'
import {
  normalizeUrl,
  parseGithubUrl
  
} from '#/shared/github-url'
import type {ParsedGithubEntity} from '#/shared/github-url';
import type { GithubExternalStatus, GithubRefType } from '#/shared/constants'
import { decryptSecret } from '../crypto'
import {
  ConflictError,
  ExternalApiError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../errors'

export interface GithubRepoMetadata {
  githubRepositoryId: number
  owner: string
  name: string
  fullName: string
  normalizedFullName: string
  description: string | null
  url: string
  language: string | null
  defaultBranch: string | null
  stars: number
  forks: number
  visibility: string
  isArchived: boolean
  etag: string | null
}

export interface GithubEntityMetadata {
  referenceType: GithubRefType
  externalId: string
  number: number | null
  url: string
  normalizedUrl: string
  title: string
  externalStatus: GithubExternalStatus
  isDraft: boolean
  mergedAt: Date | null
  closedAt: Date | null
  etag: string | null
}

export interface OctokitFactory {
  create: (token: string | null) => Octokit
}

const defaultOctokitFactory: OctokitFactory = {
  create(token: string | null) {
    return new Octokit({
      auth: token ?? undefined,
      userAgent: 'ContribHub/1.0',
    })
  },
}

export async function getUserGithubContext(
  userId: string,
  database: Database = db,
) {
  const [account] = await database
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1)

  if (!account) {
    return {
      connected: false as const,
      account: null,
      token: null,
    }
  }

  let token: string | null = null
  try {
    token = decryptSecret({
      encryptedAccessToken: account.encryptedAccessToken,
      tokenIv: account.tokenIv,
      tokenAuthTag: account.tokenAuthTag,
    })
  } catch {
    token = null
  }

  return {
    connected: Boolean(token),
    account,
    token,
  }
}

export async function getGithubConnectionStatus(
  userId: string,
  database: Database = db,
) {
  const [account] = await database
    .select({
      id: githubAccounts.id,
      githubUserId: githubAccounts.githubUserId,
      username: githubAccounts.username,
      avatarUrl: githubAccounts.avatarUrl,
      scopes: githubAccounts.scopes,
      rateLimitRemaining: githubAccounts.rateLimitRemaining,
      rateLimitResetAt: githubAccounts.rateLimitResetAt,
      updatedAt: githubAccounts.updatedAt,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1)

  if (!account) {
    return { connected: false as const, account: null }
  }

  return { connected: true as const, account }
}

export async function disconnectGithubAccount(
  userId: string,
  database: Database = db,
) {
  await database
    .delete(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
  return { disconnected: true }
}

async function recordRateLimitHeaders(
  userId: string,
  headers: Record<string, string | number | undefined> | undefined,
  database: Database = db,
) {
  if (!headers) return
  const remainingRaw = headers['x-ratelimit-remaining']
  const resetRaw = headers['x-ratelimit-reset']
  const remaining =
    remainingRaw !== undefined ? Number(remainingRaw) : undefined
  const resetEpoch = resetRaw !== undefined ? Number(resetRaw) : undefined

  if (remaining === undefined || !Number.isFinite(remaining)) return

  await database
    .update(githubAccounts)
    .set({
      rateLimitRemaining: remaining,
      rateLimitResetAt:
        resetEpoch && Number.isFinite(resetEpoch)
          ? new Date(resetEpoch * 1000)
          : null,
      updatedAt: new Date(),
    })
    .where(eq(githubAccounts.userId, userId))
    .catch(() => {})
}

function handleGithubApiError(err: unknown, contextLabel: string): never {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined
  const responseHeaders =
    typeof err === 'object' && err !== null && 'response' in err
      ? (
          err as {
            response?: { headers?: Record<string, string | undefined> }
          }
        ).response?.headers
      : undefined

  if (status === 404) {
    throw new NotFoundError(
      `${contextLabel} was not found on GitHub (or is private). ContribHub v1 supports public repositories.`,
    )
  }

  const remaining = responseHeaders?.['x-ratelimit-remaining']
  if (status === 429 || (status === 403 && remaining === '0')) {
    const resetHeader = responseHeaders?.['x-ratelimit-reset']
    const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : undefined
    throw new RateLimitError(
      resetAt
        ? `GitHub API rate limit exceeded. Resets at ${resetAt.toLocaleTimeString()}. Connect your GitHub account in Settings for 5,000 requests/hour.`
        : 'GitHub API rate limit exceeded. Connect your GitHub account in Settings for higher limits.',
      resetAt,
    )
  }

  if (status === 401) {
    throw new ExternalApiError(
      'GitHub authentication token is invalid or revoked. Reconnect GitHub in Settings.',
      401,
    )
  }

  const message =
    err instanceof Error ? err.message : 'GitHub API request failed'
  throw new ExternalApiError(`GitHub API error (${contextLabel}): ${message}`)
}

export async function fetchPublicRepositoryMetadata(
  owner: string,
  repo: string,
  options: {
    userId?: string
    etag?: string | null
    database?: Database
    octokitFactory?: OctokitFactory
  } = {},
): Promise<{ notModified: true } | { notModified: false; data: GithubRepoMetadata }> {
  const database = options.database ?? db
  const factory = options.octokitFactory ?? defaultOctokitFactory
  const ghCtx = options.userId
    ? await getUserGithubContext(options.userId, database)
    : { token: null }
  const octokit = factory.create(ghCtx.token)

  try {
    const response = await octokit.rest.repos.get({
      owner,
      repo,
      headers: options.etag ? { 'If-None-Match': options.etag } : undefined,
    })

    if (options.userId) {
      await recordRateLimitHeaders(options.userId, response.headers, database)
    }

    const d = response.data
    return {
      notModified: false,
      data: {
        githubRepositoryId: d.id,
        owner: d.owner.login,
        name: d.name,
        fullName: d.full_name,
        normalizedFullName: d.full_name.toLowerCase(),
        description: d.description ?? null,
        url: d.html_url,
        language: d.language ?? null,
        defaultBranch: d.default_branch ?? null,
        stars: d.stargazers_count ?? 0,
        forks: d.forks_count ?? 0,
        visibility: d.visibility ?? (d.private ? 'private' : 'public'),
        isArchived: Boolean(d.archived),
        etag:
          typeof response.headers.etag === 'string'
            ? response.headers.etag
            : null,
      },
    }
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: number }).status)
        : undefined
    if (status === 304) {
      return { notModified: true }
    }
    handleGithubApiError(err, `Repository ${owner}/${repo}`)
  }
}

export async function fetchPublicGithubEntity(
  parsed: ParsedGithubEntity,
  options: {
    userId?: string
    etag?: string | null
    database?: Database
    octokitFactory?: OctokitFactory
  } = {},
): Promise<
  { notModified: true } | { notModified: false; data: GithubEntityMetadata }
> {
  if (parsed.entityType === 'repository') {
    throw new ValidationError('URL points to a repository, not an issue or pull request')
  }

  const database = options.database ?? db
  const factory = options.octokitFactory ?? defaultOctokitFactory
  const ghCtx = options.userId
    ? await getUserGithubContext(options.userId, database)
    : { token: null }
  const octokit = factory.create(ghCtx.token)

  const reqHeaders = options.etag ? { 'If-None-Match': options.etag } : undefined

  try {
    if (parsed.entityType === 'pull_request' && parsed.number) {
      const response = await octokit.rest.pulls.get({
        owner: parsed.owner,
        repo: parsed.name,
        pull_number: parsed.number,
        headers: reqHeaders,
      })

      if (options.userId) {
        await recordRateLimitHeaders(options.userId, response.headers, database)
      }

      const pr = response.data
      const isMerged = Boolean(pr.merged || pr.merged_at)
      const externalStatus: GithubExternalStatus = isMerged
        ? 'merged'
        : pr.state === 'open'
          ? 'open'
          : 'closed'

      return {
        notModified: false,
        data: {
          referenceType: 'pull_request',
          externalId: String(pr.id),
          number: pr.number,
          url: pr.html_url,
          normalizedUrl: normalizeUrl(pr.html_url),
          title: pr.title,
          externalStatus,
          isDraft: Boolean(pr.draft),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
          etag:
            typeof response.headers.etag === 'string'
              ? response.headers.etag
              : null,
        },
      }
    }

    if (parsed.entityType === 'issue' && parsed.number) {
      const response = await octokit.rest.issues.get({
        owner: parsed.owner,
        repo: parsed.name,
        issue_number: parsed.number,
        headers: reqHeaders,
      })

      if (options.userId) {
        await recordRateLimitHeaders(options.userId, response.headers, database)
      }

      const issue = response.data
      // GitHub's issues API also returns PRs if someone pastes /issues/N for a PR
      if (issue.pull_request) {
        return fetchPublicGithubEntity(
          {
            ...parsed,
            entityType: 'pull_request',
            entityUrl: `${parsed.url}/pull/${parsed.number}`,
            normalizedEntityUrl: `${parsed.url}/pull/${parsed.number}`.toLowerCase(),
          },
          options,
        )
      }

      return {
        notModified: false,
        data: {
          referenceType: 'issue',
          externalId: String(issue.id),
          number: issue.number,
          url: issue.html_url,
          normalizedUrl: normalizeUrl(issue.html_url),
          title: issue.title,
          externalStatus: issue.state === 'open' ? 'open' : 'closed',
          isDraft: false,
          mergedAt: null,
          closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          etag:
            typeof response.headers.etag === 'string'
              ? response.headers.etag
              : null,
        },
      }
    }

    if (parsed.entityType === 'commit' && parsed.sha) {
      const response = await octokit.rest.repos.getCommit({
        owner: parsed.owner,
        repo: parsed.name,
        ref: parsed.sha,
        headers: reqHeaders,
      })
      if (options.userId) {
        await recordRateLimitHeaders(options.userId, response.headers, database)
      }
      const commit = response.data
      const firstLine = commit.commit.message.split('\n')[0] ?? commit.sha
      return {
        notModified: false,
        data: {
          referenceType: 'commit',
          externalId: commit.sha,
          number: null,
          url: commit.html_url,
          normalizedUrl: normalizeUrl(commit.html_url),
          title: firstLine.slice(0, 240),
          externalStatus: 'unknown',
          isDraft: false,
          mergedAt: null,
          closedAt: null,
          etag:
            typeof response.headers.etag === 'string'
              ? response.headers.etag
              : null,
        },
      }
    }

    // Discussions require GraphQL or unauthenticated HTML; store cleanly without failing
    return {
      notModified: false,
      data: {
        referenceType: parsed.entityType,
        externalId: parsed.normalizedEntityUrl,
        number: parsed.number ?? null,
        url: parsed.entityUrl,
        normalizedUrl: parsed.normalizedEntityUrl,
        title: `${parsed.fullName}#${parsed.number ?? ''}`,
        externalStatus: 'unknown',
        isDraft: false,
        mergedAt: null,
        closedAt: null,
        etag: null,
      },
    }
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: number }).status)
        : undefined
    if (status === 304) {
      return { notModified: true }
    }
    handleGithubApiError(err, `${parsed.fullName}#${parsed.number ?? parsed.sha ?? ''}`)
  }
}

export async function linkGithubReference(
  userId: string,
  input: {
    contributionId: string
    url: string
    referenceType?: GithubRefType
    title?: string
    isPrimary?: boolean
    fetchMetadata?: boolean
  },
  options: { database?: Database; octokitFactory?: OctokitFactory } = {},
) {
  const database = options.database ?? db

  // Verify ownership of contribution
  const [contrib] = await database
    .select()
    .from(contributions)
    .where(
      and(
        eq(contributions.id, input.contributionId),
        eq(contributions.userId, userId),
      ),
    )
    .limit(1)

  if (!contrib) {
    throw new NotFoundError('Contribution not found')
  }

  const parsed = parseGithubUrl(input.url)
  if (!parsed || parsed.entityType === 'repository') {
    throw new ValidationError(
      'Provide a valid GitHub issue, pull request, discussion, or commit URL',
    )
  }

  let metadata: GithubEntityMetadata | null = null
  if (input.fetchMetadata !== false) {
    try {
      const fetched = await fetchPublicGithubEntity(parsed, {
        userId,
        database,
        octokitFactory: options.octokitFactory,
      })
      if (!fetched.notModified) {
        metadata = fetched.data
      }
    } catch (err) {
      // Allow linking even if GitHub is temporarily unreachable/rate-limited,
      // unless it's a clear 404 when the user explicitly asked to fetch.
      if (err instanceof RateLimitError) {
        throw err
      }
    }
  }

  const refType = metadata?.referenceType ?? input.referenceType ?? parsed.entityType
  const url = metadata?.url ?? parsed.entityUrl
  const normalizedUrl = metadata?.normalizedUrl ?? parsed.normalizedEntityUrl

  // Check duplicate on the same contribution
  const [existing] = await database
    .select()
    .from(githubReferences)
    .where(
      and(
        eq(githubReferences.contributionId, input.contributionId),
        eq(githubReferences.normalizedUrl, normalizedUrl),
      ),
    )
    .limit(1)

  if (existing) {
    throw new ConflictError('This GitHub URL is already linked to this contribution', {
      existingReferenceId: existing.id,
    })
  }

  const now = new Date()

  const created = await database.transaction(async (tx) => {
    const [ref] = await tx
      .insert(githubReferences)
      .values({
        contributionId: input.contributionId,
        userId,
        referenceType: refType,
        externalId: metadata?.externalId ?? null,
        number: metadata?.number ?? parsed.number ?? null,
        url,
        normalizedUrl,
        title: input.title?.trim() || metadata?.title || `${parsed.fullName}#${parsed.number ?? ''}`,
        externalStatus: metadata?.externalStatus ?? 'unknown',
        isDraft: metadata?.isDraft ?? false,
        isPrimary: input.isPrimary ?? false,
        mergedAt: metadata?.mergedAt ?? null,
        closedAt: metadata?.closedAt ?? null,
        etag: metadata?.etag ?? null,
        lastSyncedAt: metadata ? now : null,
      })
      .returning()

    // Update upstreamOutcome if this is a PR (NEVER changes personalStatus!)
    if (refType === 'pull_request' && metadata) {
      const nextOutcome =
        metadata.externalStatus === 'merged'
          ? 'merged'
          : metadata.externalStatus === 'open'
            ? 'open_pr'
            : metadata.externalStatus === 'closed'
              ? 'closed_unmerged'
              : contrib.upstreamOutcome

      if (nextOutcome !== contrib.upstreamOutcome) {
        await tx
          .update(contributions)
          .set({ upstreamOutcome: nextOutcome, updatedAt: now })
          .where(eq(contributions.id, contrib.id))
      }
    }

    await tx.insert(contributionEvents).values({
      contributionId: contrib.id,
      userId,
      actorType: 'user',
      eventType: 'github_ref_linked',
      metadata: {
        referenceId: ref.id,
        referenceType: ref.referenceType,
        url: ref.url,
        externalStatus: ref.externalStatus,
      },
    })

    return ref
  })

  return created
}

export async function unlinkGithubReference(
  userId: string,
  referenceId: string,
  database: Database = db,
) {
  const [ref] = await database
    .select()
    .from(githubReferences)
    .where(
      and(
        eq(githubReferences.id, referenceId),
        eq(githubReferences.userId, userId),
      ),
    )
    .limit(1)

  if (!ref) {
    throw new NotFoundError('GitHub reference not found')
  }

  await database.transaction(async (tx) => {
    await tx
      .delete(githubReferences)
      .where(eq(githubReferences.id, referenceId))

    await tx.insert(contributionEvents).values({
      contributionId: ref.contributionId,
      userId,
      actorType: 'user',
      eventType: 'github_ref_unlinked',
      metadata: { url: ref.url, referenceType: ref.referenceType },
    })
  })

  return { deleted: true }
}

/**
 * Synchronizes a single GitHub reference against the live GitHub API.
 * Enforces strict separation: NEVER automatically mutates `personalStatus`.
 */
export async function syncGithubReference(
  userId: string,
  referenceId: string,
  options: { database?: Database; octokitFactory?: OctokitFactory } = {},
) {
  const database = options.database ?? db
  const [ref] = await database
    .select()
    .from(githubReferences)
    .where(
      and(
        eq(githubReferences.id, referenceId),
        eq(githubReferences.userId, userId),
      ),
    )
    .limit(1)

  if (!ref) {
    throw new NotFoundError('GitHub reference not found')
  }

  const parsed = parseGithubUrl(ref.url)
  if (!parsed || parsed.entityType === 'repository') {
    throw new ValidationError('Stored GitHub reference URL cannot be parsed')
  }

  const fetched = await fetchPublicGithubEntity(parsed, {
    userId,
    etag: ref.etag,
    database,
    octokitFactory: options.octokitFactory,
  })

  const now = new Date()

  if (fetched.notModified) {
    const [updated] = await database
      .update(githubReferences)
      .set({ lastSyncedAt: now })
      .where(eq(githubReferences.id, ref.id))
      .returning()

    return {
      reference: updated,
      changed: false,
      suggestPersonalCompletion: false,
    }
  }

  const meta = fetched.data
  const statusChanged = meta.externalStatus !== ref.externalStatus
  const newlyMerged =
    meta.referenceType === 'pull_request' &&
    meta.externalStatus === 'merged' &&
    ref.externalStatus !== 'merged'
  const newlyClosedUnmerged =
    meta.referenceType === 'pull_request' &&
    meta.externalStatus === 'closed' &&
    ref.externalStatus !== 'closed'

  const result = await database.transaction(async (tx) => {
    const [updated] = await tx
      .update(githubReferences)
      .set({
        referenceType: meta.referenceType,
        externalId: meta.externalId,
        number: meta.number,
        url: meta.url,
        normalizedUrl: meta.normalizedUrl,
        title: meta.title,
        externalStatus: meta.externalStatus,
        isDraft: meta.isDraft,
        mergedAt: meta.mergedAt,
        closedAt: meta.closedAt,
        etag: meta.etag,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(githubReferences.id, ref.id))
      .returning()

    const [contrib] = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.id, ref.contributionId))
      .limit(1)

    let suggestPersonalCompletion = false

    if (contrib && meta.referenceType === 'pull_request') {
      // Update upstream outcome ONLY; personalStatus remains completely under user control
      const nextOutcome =
        meta.externalStatus === 'merged'
          ? 'merged'
          : meta.externalStatus === 'open'
            ? 'open_pr'
            : meta.externalStatus === 'closed'
              ? 'closed_unmerged'
              : contrib.upstreamOutcome

      if (nextOutcome !== contrib.upstreamOutcome) {
        await tx
          .update(contributions)
          .set({ upstreamOutcome: nextOutcome, updatedAt: now })
          .where(eq(contributions.id, contrib.id))
      }

      if (
        meta.externalStatus === 'merged' &&
        contrib.personalStatus !== 'completed'
      ) {
        suggestPersonalCompletion = true
      }
    }

    if (newlyMerged) {
      await tx.insert(contributionEvents).values({
        contributionId: ref.contributionId,
        userId,
        actorType: 'github_sync',
        eventType: 'pr_merged_detected',
        metadata: {
          referenceId: ref.id,
          url: meta.url,
          number: meta.number,
          mergedAt: meta.mergedAt?.toISOString() ?? null,
        },
      })
    } else if (newlyClosedUnmerged) {
      await tx.insert(contributionEvents).values({
        contributionId: ref.contributionId,
        userId,
        actorType: 'github_sync',
        eventType: 'pr_closed_detected',
        metadata: {
          referenceId: ref.id,
          url: meta.url,
          number: meta.number,
          merged: false,
        },
      })
    } else if (statusChanged) {
      await tx.insert(contributionEvents).values({
        contributionId: ref.contributionId,
        userId,
        actorType: 'github_sync',
        eventType: 'github_synced',
        metadata: {
          referenceId: ref.id,
          previousStatus: ref.externalStatus,
          newStatus: meta.externalStatus,
        },
      })
    }

    return {
      reference: updated,
      changed: statusChanged || meta.title !== ref.title,
      suggestPersonalCompletion,
    }
  })

  return result
}

export async function syncAllOpenReferences(
  userId: string,
  options: { database?: Database; octokitFactory?: OctokitFactory } = {},
) {
  const database = options.database ?? db
  const openRefs = await database
    .select({ id: githubReferences.id })
    .from(githubReferences)
    .where(
      and(
        eq(githubReferences.userId, userId),
        inArray(githubReferences.referenceType, ['issue', 'pull_request']),
        inArray(githubReferences.externalStatus, ['open', 'unknown']),
      ),
    )
    .orderBy(desc(githubReferences.updatedAt))
    .limit(30)

  let synced = 0
  let updated = 0
  const errors: string[] = []

  for (const ref of openRefs) {
    try {
      const res = await syncGithubReference(userId, ref.id, options)
      synced += 1
      if (res.changed) updated += 1
    } catch (err) {
      if (err instanceof RateLimitError) {
        errors.push(err.message)
        break
      }
      errors.push(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return { totalChecked: openRefs.length, synced, updated, errors }
}

export async function listUserPullRequests(
  userId: string,
  database: Database = db,
) {
  const rows = await database
    .select({
      reference: githubReferences,
      contribution: {
        id: contributions.id,
        title: contributions.title,
        personalStatus: contributions.personalStatus,
        upstreamOutcome: contributions.upstreamOutcome,
        priority: contributions.priority,
        updatedAt: contributions.updatedAt,
      },
      repository: {
        id: repositories.id,
        fullName: repositories.fullName,
        url: repositories.url,
        language: repositories.language,
      },
    })
    .from(githubReferences)
    .innerJoin(
      contributions,
      eq(githubReferences.contributionId, contributions.id),
    )
    .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
    .where(
      and(
        eq(githubReferences.userId, userId),
        eq(githubReferences.referenceType, 'pull_request'),
      ),
    )
    .orderBy(desc(githubReferences.updatedAt))

  return rows
}
