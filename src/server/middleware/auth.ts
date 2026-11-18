import { getRequestHeaders } from '@tanstack/react-start/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '#/db'
import { apiTokens, user } from '#/db/schema'
import { auth } from '../auth'
import { hashApiToken } from '../crypto'
import { UnauthorizedError } from '../errors'

export interface AuthenticatedContext {
  userId: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export async function getOptionalSession(
  explicitHeaders?: Headers,
): Promise<AuthenticatedContext | null> {
  const headers = explicitHeaders ?? getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session?.user) {
    return null
  }
  return {
    userId: session.user.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
  }
}

/**
 * Verifies the server-side Better Auth session from request headers.
 * Never accepts or trusts any client-supplied user ID.
 */
export async function requireSession(
  explicitHeaders?: Headers,
): Promise<AuthenticatedContext> {
  const ctx = await getOptionalSession(explicitHeaders)
  if (!ctx) {
    throw new UnauthorizedError('You must be signed in to perform this action')
  }
  return ctx
}

/**
 * Authenticates REST `/api/v1/*` requests using either:
 * 1. `Authorization: Bearer ch_...` personal API token (for future Browser Extension)
 * 2. Better Auth session cookie
 */
export async function requireApiAuth(
  request: Request,
): Promise<AuthenticatedContext> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const rawToken = authHeader.slice(7).trim()
    if (!rawToken.startsWith('ch_')) {
      throw new UnauthorizedError('Invalid API token format')
    }

    const tokenHash = hashApiToken(rawToken)
    const [tokenRow] = await db
      .select({
        tokenId: apiTokens.id,
        expiresAt: apiTokens.expiresAt,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(apiTokens)
      .innerJoin(user, eq(apiTokens.userId, user.id))
      .where(
        and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)),
      )
      .limit(1)

    if (!tokenRow) {
      throw new UnauthorizedError('Invalid or revoked API token')
    }
    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedError('API token has expired')
    }

    // Best-effort lastUsedAt update
    db.update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, tokenRow.tokenId))
      .catch(() => {})

    return {
      userId: tokenRow.userId,
      user: {
        id: tokenRow.userId,
        name: tokenRow.name,
        email: tokenRow.email,
        image: tokenRow.image ?? null,
      },
    }
  }

  return requireSession(request.headers)
}
