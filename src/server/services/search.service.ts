import { and, desc, eq, sql } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  contributionNotes,
  contributions,
  githubReferences,
  repositories,
  tags,
  userRepositories,
} from '#/db/schema'

export async function globalSearch(
  userId: string,
  rawQuery: string,
  database: Database = db,
) {
  const query = rawQuery.trim()
  if (!query) {
    return {
      contributions: [],
      repositories: [],
      notes: [],
      githubReferences: [],
      tags: [],
    }
  }

  const likePattern = `%${query.toLowerCase()}%`

  const [matchedContribs, matchedRepos, matchedNotes, matchedRefs, matchedTags] =
    await Promise.all([
      database
        .select({
          id: contributions.id,
          title: contributions.title,
          personalStatus: contributions.personalStatus,
          priority: contributions.priority,
          contributionType: contributions.contributionType,
          repositoryFullName: repositories.fullName,
          updatedAt: contributions.updatedAt,
        })
        .from(contributions)
        .leftJoin(repositories, eq(contributions.repositoryId, repositories.id))
        .where(
          and(
            eq(contributions.userId, userId),
            sql`(
              to_tsvector('english',
                coalesce(${contributions.title}, '') || ' ' ||
                coalesce(${contributions.description}, '') || ' ' ||
                coalesce(${contributions.proposedSolution}, '') || ' ' ||
                coalesce(${contributions.reproductionSteps}, '')
              ) @@ plainto_tsquery('english', ${query})
              OR lower(${contributions.title}) LIKE ${likePattern}
              OR lower(${contributions.description}) LIKE ${likePattern}
              OR lower(coalesce(${repositories.fullName}, '')) LIKE ${likePattern}
            )`,
          ),
        )
        .orderBy(desc(contributions.updatedAt))
        .limit(12),

      database
        .select({
          id: repositories.id,
          fullName: repositories.fullName,
          description: repositories.description,
          language: repositories.language,
          stars: repositories.stars,
        })
        .from(userRepositories)
        .innerJoin(repositories, eq(userRepositories.repositoryId, repositories.id))
        .where(
          and(
            eq(userRepositories.userId, userId),
            sql`(
              lower(${repositories.fullName}) LIKE ${likePattern}
              OR lower(coalesce(${repositories.description}, '')) LIKE ${likePattern}
              OR lower(${userRepositories.personalNotes}) LIKE ${likePattern}
            )`,
          ),
        )
        .orderBy(desc(userRepositories.updatedAt))
        .limit(8),

      database
        .select({
          id: contributionNotes.id,
          contributionId: contributionNotes.contributionId,
          contributionTitle: contributions.title,
          title: contributionNotes.title,
          contentType: contributionNotes.contentType,
          snippet: sql<string>`left(${contributionNotes.content}, 160)`,
          updatedAt: contributionNotes.updatedAt,
        })
        .from(contributionNotes)
        .innerJoin(
          contributions,
          eq(contributionNotes.contributionId, contributions.id),
        )
        .where(
          and(
            eq(contributionNotes.userId, userId),
            sql`(
              to_tsvector('english', coalesce(${contributionNotes.title}, '') || ' ' || coalesce(${contributionNotes.content}, ''))
                @@ plainto_tsquery('english', ${query})
              OR lower(${contributionNotes.title}) LIKE ${likePattern}
              OR lower(${contributionNotes.content}) LIKE ${likePattern}
            )`,
          ),
        )
        .orderBy(desc(contributionNotes.updatedAt))
        .limit(8),

      database
        .select({
          id: githubReferences.id,
          contributionId: githubReferences.contributionId,
          referenceType: githubReferences.referenceType,
          number: githubReferences.number,
          title: githubReferences.title,
          url: githubReferences.url,
          externalStatus: githubReferences.externalStatus,
        })
        .from(githubReferences)
        .where(
          and(
            eq(githubReferences.userId, userId),
            sql`(
              lower(coalesce(${githubReferences.title}, '')) LIKE ${likePattern}
              OR lower(${githubReferences.url}) LIKE ${likePattern}
              OR cast(coalesce(${githubReferences.number}, 0) as text) = ${query}
            )`,
          ),
        )
        .orderBy(desc(githubReferences.updatedAt))
        .limit(8),

      database
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          color: tags.color,
        })
        .from(tags)
        .where(
          and(
            eq(tags.userId, userId),
            sql`lower(${tags.name}) LIKE ${likePattern}`,
          ),
        )
        .limit(8),
    ])

  return {
    contributions: matchedContribs,
    repositories: matchedRepos,
    notes: matchedNotes,
    githubReferences: matchedRefs,
    tags: matchedTags,
  }
}
