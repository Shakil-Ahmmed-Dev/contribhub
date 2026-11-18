import { and, desc, eq, sql } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  contributionEvents,
  contributions,
  githubReferences,
  repositories,
} from '#/db/schema'

export async function getContributionHistory(
  userId: string,
  database: Database = db,
) {
  const [allPrs, allContribs, recentEvents, activityByMonth] = await Promise.all([
    database
      .select({
        reference: githubReferences,
        contribution: {
          id: contributions.id,
          title: contributions.title,
          personalStatus: contributions.personalStatus,
          upstreamOutcome: contributions.upstreamOutcome,
          personalCompletedAt: contributions.personalCompletedAt,
        },
        repository: {
          id: repositories.id,
          fullName: repositories.fullName,
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
      .orderBy(desc(githubReferences.updatedAt)),

    database
      .select({
        contribution: contributions,
        repository: {
          id: repositories.id,
          fullName: repositories.fullName,
          url: repositories.url,
          language: repositories.language,
        },
      })
      .from(contributions)
      .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
      .where(eq(contributions.userId, userId))
      .orderBy(desc(contributions.updatedAt)),

    database
      .select({
        id: contributionEvents.id,
        contributionId: contributionEvents.contributionId,
        contributionTitle: contributions.title,
        actorType: contributionEvents.actorType,
        eventType: contributionEvents.eventType,
        metadata: contributionEvents.metadata,
        createdAt: contributionEvents.createdAt,
      })
      .from(contributionEvents)
      .innerJoin(
        contributions,
        eq(contributionEvents.contributionId, contributions.id),
      )
      .where(eq(contributionEvents.userId, userId))
      .orderBy(desc(contributionEvents.createdAt))
      .limit(50),

    database
      .select({
        month: sql<string>`to_char(date_trunc('month', ${contributionEvents.createdAt}), 'YYYY-MM')`,
        totalEvents: sql<number>`count(*)::int`,
        completedCount: sql<number>`count(*) FILTER (WHERE ${contributionEvents.eventType} = 'completed')::int`,
        mergedCount: sql<number>`count(*) FILTER (WHERE ${contributionEvents.eventType} = 'pr_merged_detected')::int`,
      })
      .from(contributionEvents)
      .where(eq(contributionEvents.userId, userId))
      .groupBy(sql`date_trunc('month', ${contributionEvents.createdAt})`)
      .orderBy(desc(sql`date_trunc('month', ${contributionEvents.createdAt})`))
      .limit(12),
  ])

  const mergedPrs = allPrs.filter((p) => p.reference.externalStatus === 'merged')
  const openPrs = allPrs.filter((p) => p.reference.externalStatus === 'open')
  const closedUnmergedPrs = allPrs.filter(
    (p) => p.reference.externalStatus === 'closed',
  )

  const prContribIds = new Set(allPrs.map((p) => p.contribution.id))

  const completedIndependent = allContribs.filter(
    (c) =>
      c.contribution.personalStatus === 'completed' &&
      !prContribIds.has(c.contribution.id),
  )

  const personallyCompleted = allContribs.filter(
    (c) => c.contribution.personalStatus === 'completed',
  )

  const abandoned = allContribs.filter(
    (c) => c.contribution.personalStatus === 'abandoned',
  )

  // Distinct repositories contributed to (completed or PR submitted/merged)
  const repoMap = new Map<
    string,
    {
      id: string
      fullName: string
      url: string
      language: string | null
      totalCount: number
      mergedCount: number
      completedCount: number
    }
  >()

  for (const row of allContribs) {
    if (!row.repository?.id) continue
    const isContributed =
      row.contribution.personalStatus === 'completed' ||
      row.contribution.personalStatus === 'pr_submitted' ||
      row.contribution.upstreamOutcome === 'merged' ||
      row.contribution.upstreamOutcome === 'open_pr'
    if (!isContributed) continue

    const entry = repoMap.get(row.repository.id) ?? {
      id: row.repository.id,
      fullName: row.repository.fullName,
      url: row.repository.url,
      language: row.repository.language,
      totalCount: 0,
      mergedCount: 0,
      completedCount: 0,
    }
    entry.totalCount += 1
    if (row.contribution.upstreamOutcome === 'merged') entry.mergedCount += 1
    if (row.contribution.personalStatus === 'completed')
      entry.completedCount += 1
    repoMap.set(row.repository.id, entry)
  }

  return {
    summary: {
      submittedPrs: allPrs.length,
      openPrs: openPrs.length,
      mergedPrs: mergedPrs.length,
      closedUnmergedPrs: closedUnmergedPrs.length,
      personallyCompleted: personallyCompleted.length,
      completedIndependent: completedIndependent.length,
      abandoned: abandoned.length,
      repositoriesContributed: repoMap.size,
    },
    mergedPrs,
    openPrs,
    closedUnmergedPrs,
    completedIndependent,
    abandoned,
    contributedRepositories: [...repoMap.values()].sort(
      (a, b) => b.mergedCount - a.mergedCount || b.totalCount - a.totalCount,
    ),
    recentEvents,
    activityByMonth: [...activityByMonth].reverse(),
  }
}
