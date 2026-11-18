import { and, asc, eq, sql } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import { contributionTags, tags } from '#/db/schema'
import { slugifyTag } from '#/lib/utils'
import { ConflictError, NotFoundError, ValidationError } from '../errors'

export async function listUserTags(userId: string, database: Database = db) {
  return database
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      color: tags.color,
      createdAt: tags.createdAt,
      usageCount: sql<number>`coalesce((
        SELECT count(*)::int FROM contribution_tags ct WHERE ct.tag_id = ${tags.id}
      ), 0)`,
    })
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name))
}

export async function createTag(
  userId: string,
  input: { name: string; color?: string },
  database: Database = db,
) {
  const slug = slugifyTag(input.name)
  if (!slug) {
    throw new ValidationError('Tag name must contain letters or numbers')
  }

  const [existing] = await database
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.slug, slug)))
    .limit(1)

  if (existing) {
    throw new ConflictError(`Tag "${input.name}" already exists`)
  }

  const [created] = await database
    .insert(tags)
    .values({
      userId,
      name: input.name.trim(),
      slug,
      color: input.color ?? '#6366f1',
    })
    .returning()

  return created
}

export async function deleteTag(
  userId: string,
  tagId: string,
  database: Database = db,
) {
  const [deleted] = await database
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .returning()

  if (!deleted) {
    throw new NotFoundError('Tag not found')
  }

  return { deleted: true }
}

export async function setContributionTags(
  userId: string,
  contributionId: string,
  tagIds: string[],
  database: Database = db,
) {
  // Ensure every tag belongs to the authenticated user
  const ownedTags =
    tagIds.length > 0
      ? await database
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.userId, userId)))
      : []
  const ownedSet = new Set(ownedTags.map((t) => t.id))
  const validTagIds = [...new Set(tagIds.filter((id) => ownedSet.has(id)))]

  await database
    .delete(contributionTags)
    .where(eq(contributionTags.contributionId, contributionId))

  if (validTagIds.length > 0) {
    await database.insert(contributionTags).values(
      validTagIds.map((tagId) => ({
        contributionId,
        tagId,
      })),
    )
  }
}
