import { and, eq, sql } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  contributionChecklists,
  contributionEvents,
  contributionNotes,
  contributionResources,
  contributions,
} from '#/db/schema'
import type { NoteContentType, ResourceType } from '#/shared/constants'
import { NotFoundError } from '../errors'

async function assertContributionOwnership(
  userId: string,
  contributionId: string,
  database: Database,
) {
  const [row] = await database
    .select({ id: contributions.id })
    .from(contributions)
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
}

export async function createNote(
  userId: string,
  input: {
    contributionId: string
    title?: string
    content: string
    contentType?: NoteContentType
    codeLanguage?: string | null
    isPinned?: boolean
  },
  database: Database = db,
) {
  await assertContributionOwnership(userId, input.contributionId, database)

  return database.transaction(async (tx) => {
    const [note] = await tx
      .insert(contributionNotes)
      .values({
        contributionId: input.contributionId,
        userId,
        title: input.title?.trim() ?? '',
        content: input.content,
        contentType: input.contentType ?? 'investigation',
        codeLanguage: input.codeLanguage ?? null,
        isPinned: input.isPinned ?? false,
      })
      .returning()

    await tx
      .update(contributions)
      .set({ updatedAt: new Date() })
      .where(eq(contributions.id, input.contributionId))

    await tx.insert(contributionEvents).values({
      contributionId: input.contributionId,
      userId,
      actorType: 'user',
      eventType: 'note_added',
      metadata: {
        noteId: note.id,
        contentType: note.contentType,
        title: note.title || undefined,
      },
    })

    return note
  })
}

export async function updateNote(
  userId: string,
  input: {
    id: string
    title?: string
    content?: string
    contentType?: NoteContentType
    codeLanguage?: string | null
    isPinned?: boolean
  },
  database: Database = db,
) {
  const [updated] = await database
    .update(contributionNotes)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.contentType !== undefined
        ? { contentType: input.contentType }
        : {}),
      ...(input.codeLanguage !== undefined
        ? { codeLanguage: input.codeLanguage }
        : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contributionNotes.id, input.id),
        eq(contributionNotes.userId, userId),
      ),
    )
    .returning()

  if (!updated) {
    throw new NotFoundError('Note not found')
  }

  return updated
}

export async function deleteNote(
  userId: string,
  noteId: string,
  database: Database = db,
) {
  const [deleted] = await database
    .delete(contributionNotes)
    .where(
      and(eq(contributionNotes.id, noteId), eq(contributionNotes.userId, userId)),
    )
    .returning()

  if (!deleted) {
    throw new NotFoundError('Note not found')
  }
  return { deleted: true }
}

export async function createChecklistItem(
  userId: string,
  input: { contributionId: string; title: string },
  database: Database = db,
) {
  await assertContributionOwnership(userId, input.contributionId, database)

  const [maxPos] = await database
    .select({
      max: sql<number>`coalesce(max(${contributionChecklists.position}), -1)`,
    })
    .from(contributionChecklists)
    .where(eq(contributionChecklists.contributionId, input.contributionId))

  const [item] = await database
    .insert(contributionChecklists)
    .values({
      contributionId: input.contributionId,
      title: input.title.trim(),
      position: (maxPos?.max ?? -1) + 1,
    })
    .returning()

  return item
}

export async function updateChecklistItem(
  userId: string,
  input: {
    id: string
    title?: string
    isCompleted?: boolean
    position?: number
  },
  database: Database = db,
) {
  const [existing] = await database
    .select({
      item: contributionChecklists,
      ownerId: contributions.userId,
    })
    .from(contributionChecklists)
    .innerJoin(
      contributions,
      eq(contributionChecklists.contributionId, contributions.id),
    )
    .where(eq(contributionChecklists.id, input.id))
    .limit(1)

  if (!existing || existing.ownerId !== userId) {
    throw new NotFoundError('Checklist item not found')
  }

  const newlyCompleted =
    input.isCompleted === true && !existing.item.isCompleted

  return database.transaction(async (tx) => {
    const [updated] = await tx
      .update(contributionChecklists)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.isCompleted !== undefined
          ? { isCompleted: input.isCompleted }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contributionChecklists.id, input.id))
      .returning()

    if (newlyCompleted) {
      await tx.insert(contributionEvents).values({
        contributionId: existing.item.contributionId,
        userId,
        actorType: 'user',
        eventType: 'checklist_item_completed',
        metadata: { title: updated.title },
      })
    }

    return updated
  })
}

export async function deleteChecklistItem(
  userId: string,
  itemId: string,
  database: Database = db,
) {
  const [existing] = await database
    .select({
      id: contributionChecklists.id,
      ownerId: contributions.userId,
    })
    .from(contributionChecklists)
    .innerJoin(
      contributions,
      eq(contributionChecklists.contributionId, contributions.id),
    )
    .where(eq(contributionChecklists.id, itemId))
    .limit(1)

  if (!existing || existing.ownerId !== userId) {
    throw new NotFoundError('Checklist item not found')
  }

  await database
    .delete(contributionChecklists)
    .where(eq(contributionChecklists.id, itemId))

  return { deleted: true }
}

export async function createResource(
  userId: string,
  input: {
    contributionId: string
    resourceType?: ResourceType
    title: string
    urlOrPath: string
    notes?: string
  },
  database: Database = db,
) {
  await assertContributionOwnership(userId, input.contributionId, database)

  const [created] = await database
    .insert(contributionResources)
    .values({
      contributionId: input.contributionId,
      resourceType: input.resourceType ?? 'external_url',
      title: input.title.trim(),
      urlOrPath: input.urlOrPath.trim(),
      notes: input.notes?.trim() ?? '',
    })
    .returning()

  return created
}

export async function deleteResource(
  userId: string,
  resourceId: string,
  database: Database = db,
) {
  const [existing] = await database
    .select({
      id: contributionResources.id,
      ownerId: contributions.userId,
    })
    .from(contributionResources)
    .innerJoin(
      contributions,
      eq(contributionResources.contributionId, contributions.id),
    )
    .where(eq(contributionResources.id, resourceId))
    .limit(1)

  if (!existing || existing.ownerId !== userId) {
    throw new NotFoundError('Technical reference not found')
  }

  await database
    .delete(contributionResources)
    .where(eq(contributionResources.id, resourceId))

  return { deleted: true }
}
