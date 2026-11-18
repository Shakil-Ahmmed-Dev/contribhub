import { and, desc, eq, isNull } from 'drizzle-orm'
import { db  } from '#/db'
import type {Database} from '#/db';
import {
  apiTokens,
  userPreferences
  
} from '#/db/schema'
import type {SavedBacklogFilters} from '#/db/schema';
import { generateApiToken } from '../crypto'
import { NotFoundError } from '../errors'

export async function getUserPreferences(
  userId: string,
  database: Database = db,
) {
  const [prefs] = await database
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  return (
    prefs ?? {
      userId,
      defaultBacklogView: 'kanban',
      savedFilters: {},
      tableColumns: {},
      theme: 'system',
      updatedAt: new Date(),
    }
  )
}

export async function updateUserPreferences(
  userId: string,
  input: {
    defaultBacklogView?: 'kanban' | 'table' | 'repos' | 'priority'
    savedFilters?: SavedBacklogFilters
    tableColumns?: Record<string, boolean>
    theme?: 'light' | 'dark' | 'system'
  },
  database: Database = db,
) {
  const existing = await getUserPreferences(userId, database)
  const now = new Date()

  const [saved] = await database
    .insert(userPreferences)
    .values({
      userId,
      defaultBacklogView:
        input.defaultBacklogView ?? existing.defaultBacklogView,
      savedFilters: input.savedFilters ?? existing.savedFilters,
      tableColumns: input.tableColumns ?? existing.tableColumns,
      theme: input.theme ?? existing.theme,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...(input.defaultBacklogView !== undefined
          ? { defaultBacklogView: input.defaultBacklogView }
          : {}),
        ...(input.savedFilters !== undefined
          ? { savedFilters: input.savedFilters }
          : {}),
        ...(input.tableColumns !== undefined
          ? { tableColumns: input.tableColumns }
          : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        updatedAt: now,
      },
    })
    .returning()

  return saved
}

export async function listApiTokens(userId: string, database: Database = db) {
  return database
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt))
}

export async function createApiToken(
  userId: string,
  name: string,
  database: Database = db,
) {
  const { rawToken, tokenPrefix, tokenHash } = generateApiToken()
  const [created] = await database
    .insert(apiTokens)
    .values({
      userId,
      name: name.trim(),
      tokenPrefix,
      tokenHash,
    })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      createdAt: apiTokens.createdAt,
    })

  // Raw token is shown exactly once on creation
  return { ...created, rawToken }
}

export async function revokeApiToken(
  userId: string,
  tokenId: string,
  database: Database = db,
) {
  const [revoked] = await database
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id })

  if (!revoked) {
    throw new NotFoundError('API token not found')
  }
  return { revoked: true }
}
