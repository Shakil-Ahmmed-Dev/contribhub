import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '#/server/middleware/auth'
import {
  createChecklistItem,
  createNote,
  createResource,
  deleteChecklistItem,
  deleteNote,
  deleteResource,
  updateChecklistItem,
  updateNote,
} from '#/server/services/research.service'
import {
  createChecklistItemSchema,
  createNoteSchema,
  createResourceSchema,
  updateChecklistItemSchema,
  updateNoteSchema,
} from '#/shared/schemas'

export const createNoteFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => createNoteSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return createNote(userId, data)
  })

export const updateNoteFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => updateNoteSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return updateNote(userId, data)
  })

export const deleteNoteFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return deleteNote(userId, data.id)
  })

export const createChecklistItemFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => createChecklistItemSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return createChecklistItem(userId, data)
  })

export const updateChecklistItemFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => updateChecklistItemSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return updateChecklistItem(userId, data)
  })

export const deleteChecklistItemFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return deleteChecklistItem(userId, data.id)
  })

export const createResourceFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => createResourceSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return createResource(userId, data)
  })

export const deleteResourceFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return deleteResource(userId, data.id)
  })
