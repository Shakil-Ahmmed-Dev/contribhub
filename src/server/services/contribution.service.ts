import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  contributionChecklists,
  contributionEvents,
  contributionNotes,
  contributionResources,
  contributions,
  contributionTags,
  githubReferences,
  repositories,
  tags,
  userRepositories,
} from '#/db/schema'
import type {
  ContributionType,
  EstimatedEffort,
  PersonalStatus,
  Priority,
  UpstreamOutcome,
} from '#/shared/constants'
import { normalizeUrl, parseGithubUrl } from '#/shared/github-url'
import { NotFoundError } from '../errors'
import {
  linkGithubReference
  
} from './github.service'
import type {OctokitFactory} from './github.service';
import {
  addRepositoryForUser,
  ensureUserTracksRepository,
} from './repository.service'
import { setContributionTags } from './tag.service'

export interface ContributionListItem {
  id: string
  title: string
  description: string
  contributionType: ContributionType
  personalStatus: PersonalStatus
  upstreamOutcome: UpstreamOutcome
  priority: Priority
  estimatedEffort: EstimatedEffort | null
  sourceUrl: string | null
  kanbanPosition: number
  personalCompletedAt: Date | null
  abandonedAt: Date | null
  createdAt: Date
  updatedAt: Date
  repository: {
    id: string
    fullName: string
    owner: string
    name: string
    url: string
    language: string | null
  } | null
  tags: Array<{ id: string; name: string; slug: string; color: string }>
  githubReferences: Array<{
    id: string
    referenceType: string
    number: number | null
    url: string
    title: string | null
    externalStatus: string
    isDraft: boolean
  }>
  checklistSummary: { total: number; completed: number }
}

export async function getDashboardSummary(
  userId: string,
  database: Database = db,
) {
  const statusRows = await database
    .select({
      status: contributions.personalStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(contributions)
    .where(eq(contributions.userId, userId))
    .groupBy(contributions.personalStatus)

  const counts: Record<PersonalStatus, number> = {
    inbox: 0,
    researching: 0,
    ready: 0,
    in_progress: 0,
    pr_submitted: 0,
    completed: 0,
    abandoned: 0,
  }
  let total = 0
  for (const row of statusRows) {
    counts[row.status] = row.count
    total += row.count
  }

  const [prCounts] = await database
    .select({
      totalPrs: sql<number>`count(*)::int`,
      openPrs: sql<number>`count(*) FILTER (WHERE ${githubReferences.externalStatus} = 'open')::int`,
      mergedPrs: sql<number>`count(*) FILTER (WHERE ${githubReferences.externalStatus} = 'merged')::int`,
    })
    .from(githubReferences)
    .where(
      and(
        eq(githubReferences.userId, userId),
        eq(githubReferences.referenceType, 'pull_request'),
      ),
    )

  const recentContributions = await database
    .select({
      id: contributions.id,
      title: contributions.title,
      personalStatus: contributions.personalStatus,
      priority: contributions.priority,
      contributionType: contributions.contributionType,
      upstreamOutcome: contributions.upstreamOutcome,
      updatedAt: contributions.updatedAt,
      repository: {
        id: repositories.id,
        fullName: repositories.fullName,
        language: repositories.language,
      },
    })
    .from(contributions)
    .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
    .where(eq(contributions.userId, userId))
    .orderBy(desc(contributions.updatedAt))
    .limit(8)

  const recentRepositories = await database
    .select({
      id: repositories.id,
      fullName: repositories.fullName,
      description: repositories.description,
      language: repositories.language,
      stars: repositories.stars,
      url: repositories.url,
      trackingStatus: userRepositories.trackingStatus,
      createdAt: userRepositories.createdAt,
    })
    .from(userRepositories)
    .innerJoin(repositories, eq(userRepositories.repositoryId, repositories.id))
    .where(eq(userRepositories.userId, userId))
    .orderBy(desc(userRepositories.createdAt))
    .limit(6)

  const readyQueue = await database
    .select({
      id: contributions.id,
      title: contributions.title,
      priority: contributions.priority,
      estimatedEffort: contributions.estimatedEffort,
      contributionType: contributions.contributionType,
      repository: {
        id: repositories.id,
        fullName: repositories.fullName,
      },
    })
    .from(contributions)
    .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
    .where(
      and(
        eq(contributions.userId, userId),
        eq(contributions.personalStatus, 'ready'),
      ),
    )
    .orderBy(
      sql`CASE ${contributions.priority}
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        ELSE 1
      END DESC`,
      desc(contributions.updatedAt),
    )
    .limit(5)

  return {
    counts: {
      total,
      ...counts,
      submittedPrs: Math.max(counts.pr_submitted, prCounts?.totalPrs ?? 0),
      openPrs: prCounts?.openPrs ?? 0,
      mergedPrs: prCounts?.mergedPrs ?? 0,
    },
    recentContributions,
    recentRepositories,
    readyQueue,
  }
}

export async function findDuplicateContributionsByUrl(
  userId: string,
  rawUrl: string,
  database: Database = db,
) {
  const normalized = normalizeUrl(rawUrl)

  const byRef = await database
    .select({
      contributionId: contributions.id,
      title: contributions.title,
      personalStatus: contributions.personalStatus,
      referenceUrl: githubReferences.url,
      referenceType: githubReferences.referenceType,
    })
    .from(githubReferences)
    .innerJoin(
      contributions,
      eq(githubReferences.contributionId, contributions.id),
    )
    .where(
      and(
        eq(githubReferences.userId, userId),
        eq(githubReferences.normalizedUrl, normalized),
      ),
    )
    .limit(5)

  if (byRef.length > 0) return byRef

  // Also check sourceUrl
  const bySource = await database
    .select({
      contributionId: contributions.id,
      title: contributions.title,
      personalStatus: contributions.personalStatus,
      referenceUrl: contributions.sourceUrl,
      referenceType: sql<string>`'source_url'`,
    })
    .from(contributions)
    .where(
      and(
        eq(contributions.userId, userId),
        sql`lower(rtrim(coalesce(${contributions.sourceUrl}, ''), '/')) = ${normalized}`,
      ),
    )
    .limit(5)

  return bySource
}

export async function createContribution(
  userId: string,
  input: {
    title: string
    description?: string
    proposedSolution?: string
    reproductionSteps?: string
    repositoryId?: string | null
    repositoryIdentifier?: string
    contributionType?: ContributionType
    personalStatus?: PersonalStatus
    priority?: Priority
    estimatedEffort?: EstimatedEffort | null
    sourceUrl?: string | null
    githubIssueUrl?: string | null
    tagIds?: string[]
    initialNote?: string
  },
  options: { database?: Database; octokitFactory?: OctokitFactory; skipGithubLookup?: boolean } = {},
) {
  const database = options.database ?? db
  let resolvedRepoId = input.repositoryId ?? null

  // Auto-resolve repository from repositoryIdentifier or githubIssueUrl / sourceUrl if not selected
  const urlCandidate =
    input.repositoryIdentifier?.trim() ||
    input.githubIssueUrl?.trim() ||
    input.sourceUrl?.trim()

  if (!resolvedRepoId && urlCandidate) {
    const parsed = parseGithubUrl(urlCandidate)
    if (parsed) {
      const added = await addRepositoryForUser(
        userId,
        {
          identifier: parsed.fullName,
          skipGithubLookup: options.skipGithubLookup,
        },
        { database, octokitFactory: options.octokitFactory },
      )
      resolvedRepoId = added.repository.id
    }
  } else if (resolvedRepoId) {
    // Ensure repository exists and is linked to user's library
    const [repoExists] = await database
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.id, resolvedRepoId))
      .limit(1)
    if (!repoExists) {
      throw new NotFoundError('Selected repository does not exist')
    }
    await ensureUserTracksRepository(userId, resolvedRepoId, database)
  }

  const targetStatus: PersonalStatus = input.personalStatus ?? 'inbox'
  const now = new Date()

  // Compute next kanbanPosition in the target column
  const [maxPosRow] = await database
    .select({
      maxPos: sql<number>`coalesce(max(${contributions.kanbanPosition}), 0)`,
    })
    .from(contributions)
    .where(
      and(
        eq(contributions.userId, userId),
        eq(contributions.personalStatus, targetStatus),
      ),
    )

  const nextKanbanPosition = (maxPosRow?.maxPos ?? 0) + 1000

  const created = await database.transaction(async (tx) => {
    const [row] = await tx
      .insert(contributions)
      .values({
        userId,
        repositoryId: resolvedRepoId,
        title: input.title.trim(),
        description: input.description ?? '',
        proposedSolution: input.proposedSolution ?? '',
        reproductionSteps: input.reproductionSteps ?? '',
        contributionType: input.contributionType ?? 'bug_or_improvement',
        personalStatus: targetStatus,
        priority: input.priority ?? 'medium',
        estimatedEffort: input.estimatedEffort ?? null,
        sourceUrl: input.sourceUrl ?? null,
        kanbanPosition: nextKanbanPosition,
        personalCompletedAt: targetStatus === 'completed' ? now : null,
        abandonedAt: targetStatus === 'abandoned' ? now : null,
      })
      .returning()

    if (input.tagIds && input.tagIds.length > 0) {
      await setContributionTags(userId, row.id, input.tagIds, tx as unknown as Database)
    }

    if (input.initialNote?.trim()) {
      await tx.insert(contributionNotes).values({
        contributionId: row.id,
        userId,
        title: 'Initial capture note',
        content: input.initialNote.trim(),
        contentType: 'general',
      })
    }

    await tx.insert(contributionEvents).values({
      contributionId: row.id,
      userId,
      actorType: 'user',
      eventType: 'created',
      metadata: {
        status: row.personalStatus,
        contributionType: row.contributionType,
        priority: row.priority,
        repositoryId: row.repositoryId,
      },
    })

    return row
  })

  // Optional GitHub issue/PR URL linking (never mandatory)
  if (input.githubIssueUrl?.trim()) {
    const parsedIssue = parseGithubUrl(input.githubIssueUrl)
    if (parsedIssue && parsedIssue.entityType !== 'repository') {
      try {
        await linkGithubReference(
          userId,
          {
            contributionId: created.id,
            url: input.githubIssueUrl,
            isPrimary: true,
            fetchMetadata: !options.skipGithubLookup,
          },
          { database, octokitFactory: options.octokitFactory },
        )
      } catch {
        // Contribution is safely persisted even if optional GitHub link fetch fails
      }
    }
  }

  return created
}

export async function listContributions(
  userId: string,
  filters: {
    repositoryId?: string
    statuses?: PersonalStatus[]
    priorities?: Priority[]
    types?: ContributionType[]
    tagIds?: string[]
    search?: string
    sortBy?: 'updatedAt' | 'createdAt' | 'priority' | 'title' | 'kanbanPosition'
    sortDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
  } = {},
  database: Database = db,
): Promise<{
  items: ContributionListItem[]
  total: number
  page: number
  pageSize: number
}> {
  const conditions = [eq(contributions.userId, userId)]

  if (filters.repositoryId) {
    conditions.push(eq(contributions.repositoryId, filters.repositoryId))
  }
  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(inArray(contributions.personalStatus, filters.statuses))
  }
  if (filters.priorities && filters.priorities.length > 0) {
    conditions.push(inArray(contributions.priority, filters.priorities))
  }
  if (filters.types && filters.types.length > 0) {
    conditions.push(inArray(contributions.contributionType, filters.types))
  }
  if (filters.tagIds && filters.tagIds.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM contribution_tags ct
        WHERE ct.contribution_id = ${contributions.id}
          AND ct.tag_id IN (${sql.join(
            filters.tagIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      )`,
    )
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim().toLowerCase()}%`
    conditions.push(
      sql`(
        lower(${contributions.title}) LIKE ${q}
        OR lower(${contributions.description}) LIKE ${q}
        OR lower(coalesce(${repositories.fullName}, '')) LIKE ${q}
        OR EXISTS (
          SELECT 1 FROM contribution_notes n
          WHERE n.contribution_id = ${contributions.id}
            AND (lower(n.title) LIKE ${q} OR lower(n.content) LIKE ${q})
        )
        OR EXISTS (
          SELECT 1 FROM github_references gr
          WHERE gr.contribution_id = ${contributions.id}
            AND (lower(coalesce(gr.title, '')) LIKE ${q} OR lower(gr.url) LIKE ${q})
        )
      )`,
    )
  }

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc'
  const orderExpr = (() => {
    switch (filters.sortBy) {
      case 'createdAt':
        return sortDir === 'asc'
          ? asc(contributions.createdAt)
          : desc(contributions.createdAt)
      case 'title':
        return sortDir === 'asc'
          ? asc(contributions.title)
          : desc(contributions.title)
      case 'kanbanPosition':
        return sortDir === 'asc'
          ? asc(contributions.kanbanPosition)
          : desc(contributions.kanbanPosition)
      case 'priority': {
        const weightSql = sql`CASE ${contributions.priority}
          WHEN 'urgent' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END`
        return sortDir === 'asc' ? asc(weightSql) : desc(weightSql)
      }
      case 'updatedAt':
      default:
        return sortDir === 'asc'
          ? asc(contributions.updatedAt)
          : desc(contributions.updatedAt)
    }
  })()

  const [{ count: total }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(contributions)
    .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
    .where(and(...conditions))

  const rows = await database
    .select({
      contribution: contributions,
      repository: {
        id: repositories.id,
        fullName: repositories.fullName,
        owner: repositories.owner,
        name: repositories.name,
        url: repositories.url,
        language: repositories.language,
      },
    })
    .from(contributions)
    .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
    .where(and(...conditions))
    .orderBy(orderExpr, desc(contributions.updatedAt))
    .limit(pageSize)
    .offset(offset)

  const ids = rows.map((r) => r.contribution.id)
  if (ids.length === 0) {
    return { items: [], total, page, pageSize }
  }

  // Batch-load tags, github references, and checklist counts (zero N+1 queries)
  const [tagRows, refRows, checklistRows] = await Promise.all([
    database
      .select({
        contributionId: contributionTags.contributionId,
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        color: tags.color,
      })
      .from(contributionTags)
      .innerJoin(tags, eq(contributionTags.tagId, tags.id))
      .where(inArray(contributionTags.contributionId, ids)),
    database
      .select({
        contributionId: githubReferences.contributionId,
        id: githubReferences.id,
        referenceType: githubReferences.referenceType,
        number: githubReferences.number,
        url: githubReferences.url,
        title: githubReferences.title,
        externalStatus: githubReferences.externalStatus,
        isDraft: githubReferences.isDraft,
      })
      .from(githubReferences)
      .where(inArray(githubReferences.contributionId, ids)),
    database
      .select({
        contributionId: contributionChecklists.contributionId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${contributionChecklists.isCompleted})::int`,
      })
      .from(contributionChecklists)
      .where(inArray(contributionChecklists.contributionId, ids))
      .groupBy(contributionChecklists.contributionId),
  ])

  const tagsByContrib = new Map<
    string,
    Array<{ id: string; name: string; slug: string; color: string }>
  >()
  for (const t of tagRows) {
    const arr = tagsByContrib.get(t.contributionId) ?? []
    arr.push({ id: t.id, name: t.name, slug: t.slug, color: t.color })
    tagsByContrib.set(t.contributionId, arr)
  }

  const refsByContrib = new Map<
    string,
    ContributionListItem['githubReferences']
  >()
  for (const r of refRows) {
    const arr = refsByContrib.get(r.contributionId) ?? []
    arr.push({
      id: r.id,
      referenceType: r.referenceType,
      number: r.number,
      url: r.url,
      title: r.title,
      externalStatus: r.externalStatus,
      isDraft: r.isDraft,
    })
    refsByContrib.set(r.contributionId, arr)
  }

  const checklistByContrib = new Map<
    string,
    { total: number; completed: number }
  >()
  for (const c of checklistRows) {
    checklistByContrib.set(c.contributionId, {
      total: c.total,
      completed: c.completed,
    })
  }

  const items: ContributionListItem[] = rows.map((row) => ({
    id: row.contribution.id,
    title: row.contribution.title,
    description: row.contribution.description,
    contributionType: row.contribution.contributionType,
    personalStatus: row.contribution.personalStatus,
    upstreamOutcome: row.contribution.upstreamOutcome,
    priority: row.contribution.priority,
    estimatedEffort: row.contribution.estimatedEffort,
    sourceUrl: row.contribution.sourceUrl,
    kanbanPosition: row.contribution.kanbanPosition,
    personalCompletedAt: row.contribution.personalCompletedAt,
    abandonedAt: row.contribution.abandonedAt,
    createdAt: row.contribution.createdAt,
    updatedAt: row.contribution.updatedAt,
    repository: row.repository?.id ? row.repository : null,
    tags: tagsByContrib.get(row.contribution.id) ?? [],
    githubReferences: refsByContrib.get(row.contribution.id) ?? [],
    checklistSummary: checklistByContrib.get(row.contribution.id) ?? {
      total: 0,
      completed: 0,
    },
  }))

  return { items, total, page, pageSize }
}

export async function getContributionDetail(
  userId: string,
  contributionId: string,
  database: Database = db,
) {
  const [row] = await database
    .select({
      contribution: contributions,
      repository: repositories,
    })
    .from(contributions)
    .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
    .where(
      and(
        eq(contributions.id, contributionId),
        eq(contributions.userId, userId),
      ),
    )
    .limit(1)

  if (!row) {
    throw new NotFoundError('Contribution not found')
  }

  const [notes, checklists, resources, refs, tagRows, events] =
    await Promise.all([
      database
        .select()
        .from(contributionNotes)
        .where(eq(contributionNotes.contributionId, contributionId))
        .orderBy(desc(contributionNotes.isPinned), desc(contributionNotes.updatedAt)),
      database
        .select()
        .from(contributionChecklists)
        .where(eq(contributionChecklists.contributionId, contributionId))
        .orderBy(asc(contributionChecklists.position), asc(contributionChecklists.createdAt)),
      database
        .select()
        .from(contributionResources)
        .where(eq(contributionResources.contributionId, contributionId))
        .orderBy(desc(contributionResources.createdAt)),
      database
        .select()
        .from(githubReferences)
        .where(eq(githubReferences.contributionId, contributionId))
        .orderBy(desc(githubReferences.isPrimary), desc(githubReferences.createdAt)),
      database
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          color: tags.color,
        })
        .from(contributionTags)
        .innerJoin(tags, eq(contributionTags.tagId, tags.id))
        .where(eq(contributionTags.contributionId, contributionId)),
      database
        .select()
        .from(contributionEvents)
        .where(eq(contributionEvents.contributionId, contributionId))
        .orderBy(desc(contributionEvents.createdAt))
        .limit(50),
    ])

  const hasMergedPr = refs.some(
    (r) => r.referenceType === 'pull_request' && r.externalStatus === 'merged',
  )
  const suggestCompletion =
    hasMergedPr && row.contribution.personalStatus !== 'completed'

  return {
    contribution: row.contribution,
    repository: row.repository,
    notes,
    checklists,
    resources,
    githubReferences: refs,
    tags: tagRows,
    events,
    suggestCompletion,
  }
}

export async function updateContribution(
  userId: string,
  input: {
    id: string
    title?: string
    description?: string
    proposedSolution?: string
    reproductionSteps?: string
    repositoryId?: string | null
    contributionType?: ContributionType
    personalStatus?: PersonalStatus
    upstreamOutcome?: UpstreamOutcome
    priority?: Priority
    estimatedEffort?: EstimatedEffort | null
    sourceUrl?: string | null
    abandonedReason?: string | null
    tagIds?: string[]
  },
  database: Database = db,
) {
  const [existing] = await database
    .select()
    .from(contributions)
    .where(and(eq(contributions.id, input.id), eq(contributions.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new NotFoundError('Contribution not found')
  }

  if (input.repositoryId) {
    const [repoExists] = await database
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.id, input.repositoryId))
      .limit(1)
    if (!repoExists) {
      throw new NotFoundError('Selected repository does not exist')
    }
    await ensureUserTracksRepository(userId, input.repositoryId, database)
  }

  const now = new Date()
  const nextStatus = input.personalStatus ?? existing.personalStatus
  const statusChanged = nextStatus !== existing.personalStatus
  const priorityChanged =
    input.priority !== undefined && input.priority !== existing.priority

  const updated = await database.transaction(async (tx) => {
    const [row] = await tx
      .update(contributions)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.proposedSolution !== undefined
          ? { proposedSolution: input.proposedSolution }
          : {}),
        ...(input.reproductionSteps !== undefined
          ? { reproductionSteps: input.reproductionSteps }
          : {}),
        ...(input.repositoryId !== undefined
          ? { repositoryId: input.repositoryId }
          : {}),
        ...(input.contributionType !== undefined
          ? { contributionType: input.contributionType }
          : {}),
        ...(input.personalStatus !== undefined
          ? { personalStatus: input.personalStatus }
          : {}),
        ...(input.upstreamOutcome !== undefined
          ? { upstreamOutcome: input.upstreamOutcome }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.estimatedEffort !== undefined
          ? { estimatedEffort: input.estimatedEffort }
          : {}),
        ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
        ...(input.abandonedReason !== undefined
          ? { abandonedReason: input.abandonedReason }
          : {}),
        ...(statusChanged && nextStatus === 'completed'
          ? { personalCompletedAt: now }
          : {}),
        ...(statusChanged && nextStatus !== 'completed'
          ? { personalCompletedAt: null }
          : {}),
        ...(statusChanged && nextStatus === 'abandoned'
          ? { abandonedAt: now }
          : {}),
        ...(statusChanged && nextStatus !== 'abandoned'
          ? { abandonedAt: null }
          : {}),
        updatedAt: now,
      })
      .where(
        and(eq(contributions.id, input.id), eq(contributions.userId, userId)),
      )
      .returning()

    if (input.tagIds !== undefined) {
      await setContributionTags(
        userId,
        input.id,
        input.tagIds,
        tx as unknown as Database,
      )
    }

    if (statusChanged) {
      await tx.insert(contributionEvents).values({
        contributionId: row.id,
        userId,
        actorType: 'user',
        eventType:
          nextStatus === 'completed'
            ? 'completed'
            : nextStatus === 'abandoned'
              ? 'abandoned'
              : 'status_changed',
        metadata: {
          from: existing.personalStatus,
          to: nextStatus,
        },
      })
    }

    if (priorityChanged) {
      await tx.insert(contributionEvents).values({
        contributionId: row.id,
        userId,
        actorType: 'user',
        eventType: 'priority_changed',
        metadata: {
          from: existing.priority,
          to: input.priority,
        },
      })
    }

    if (
      input.repositoryId !== undefined &&
      input.repositoryId !== existing.repositoryId
    ) {
      await tx.insert(contributionEvents).values({
        contributionId: row.id,
        userId,
        actorType: 'user',
        eventType: 'repository_linked',
        metadata: {
          previousRepositoryId: existing.repositoryId,
          repositoryId: input.repositoryId,
        },
      })
    }

    return row
  })

  return updated
}

export async function moveContributionStatus(
  userId: string,
  input: {
    id: string
    personalStatus: PersonalStatus
    kanbanPosition?: number
    abandonedReason?: string
  },
  database: Database = db,
) {
  const [existing] = await database
    .select()
    .from(contributions)
    .where(and(eq(contributions.id, input.id), eq(contributions.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new NotFoundError('Contribution not found')
  }

  const now = new Date()
  const statusChanged = input.personalStatus !== existing.personalStatus

  let position = input.kanbanPosition
  if (position === undefined) {
    const [maxRow] = await database
      .select({
        maxPos: sql<number>`coalesce(max(${contributions.kanbanPosition}), 0)`,
      })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, userId),
          eq(contributions.personalStatus, input.personalStatus),
        ),
      )
    position = (maxRow?.maxPos ?? 0) + 1000
  }

  return database.transaction(async (tx) => {
    const [updated] = await tx
      .update(contributions)
      .set({
        personalStatus: input.personalStatus,
        kanbanPosition: position,
        ...(statusChanged && input.personalStatus === 'completed'
          ? { personalCompletedAt: now }
          : {}),
        ...(statusChanged && input.personalStatus !== 'completed'
          ? { personalCompletedAt: null }
          : {}),
        ...(statusChanged && input.personalStatus === 'abandoned'
          ? {
              abandonedAt: now,
              abandonedReason: input.abandonedReason ?? existing.abandonedReason,
            }
          : {}),
        ...(statusChanged && input.personalStatus !== 'abandoned'
          ? { abandonedAt: null }
          : {}),
        updatedAt: now,
      })
      .where(
        and(eq(contributions.id, input.id), eq(contributions.userId, userId)),
      )
      .returning()

    if (statusChanged) {
      await tx.insert(contributionEvents).values({
        contributionId: updated.id,
        userId,
        actorType: 'user',
        eventType:
          input.personalStatus === 'completed'
            ? 'completed'
            : input.personalStatus === 'abandoned'
              ? 'abandoned'
              : 'status_changed',
        metadata: {
          from: existing.personalStatus,
          to: input.personalStatus,
        },
      })
    }

    return updated
  })
}

export async function deleteContribution(
  userId: string,
  contributionId: string,
  database: Database = db,
) {
  const [deleted] = await database
    .delete(contributions)
    .where(
      and(
        eq(contributions.id, contributionId),
        eq(contributions.userId, userId),
      ),
    )
    .returning()

  if (!deleted) {
    throw new NotFoundError('Contribution not found')
  }
  return { deleted: true }
}
