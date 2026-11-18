import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import * as schema from '#/db/schema'
import { encryptSecret } from './crypto'

const githubClientId = process.env.GITHUB_CLIENT_ID?.trim()
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim()

export const isGithubOAuthConfigured = Boolean(
  githubClientId && githubClientSecret,
)

async function syncEncryptedGithubAccount(accountRecord: {
  userId: string
  providerId: string
  accountId: string
  accessToken?: string | null
  scope?: string | null
}) {
  if (accountRecord.providerId !== 'github' || !accountRecord.accessToken) {
    return
  }

  const githubUserId = Number(accountRecord.accountId)
  if (!Number.isFinite(githubUserId)) return

  try {
    // Fetch minimal public GitHub profile to populate username & avatar
    let username = `github-${githubUserId}`
    let avatarUrl: string | null = null

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accountRecord.accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ContribHub/1.0',
        },
      })
      if (res.ok) {
        const profile = (await res.json()) as {
          login?: string
          avatar_url?: string
        }
        if (profile.login) username = profile.login
        if (profile.avatar_url) avatarUrl = profile.avatar_url
      }
    } catch {
      // Non-fatal: keep fallback username
    }

    const encrypted = encryptSecret(accountRecord.accessToken)
    const now = new Date()

    await db
      .insert(schema.githubAccounts)
      .values({
        userId: accountRecord.userId,
        githubUserId,
        username,
        avatarUrl,
        encryptedAccessToken: encrypted.encryptedAccessToken,
        tokenIv: encrypted.tokenIv,
        tokenAuthTag: encrypted.tokenAuthTag,
        keyVersion: encrypted.keyVersion,
        scopes: accountRecord.scope ?? 'read:user user:email',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.githubAccounts.userId,
        set: {
          githubUserId,
          username,
          avatarUrl,
          encryptedAccessToken: encrypted.encryptedAccessToken,
          tokenIv: encrypted.tokenIv,
          tokenAuthTag: encrypted.tokenAuthTag,
          keyVersion: encrypted.keyVersion,
          scopes: accountRecord.scope ?? 'read:user user:email',
          updatedAt: now,
        },
      })

    // Clear raw OAuth token on Better Auth account table once securely vaulted in github_accounts
    await db
      .update(schema.account)
      .set({ accessToken: null, refreshToken: null })
      .where(eq(schema.account.userId, accountRecord.userId))
  } catch (err) {
    console.error(
      '[ContribHub Auth] Failed to vault GitHub OAuth token:',
      err instanceof Error ? err.message : 'Unknown error',
    )
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: isGithubOAuthConfigured
    ? {
        github: {
          clientId: githubClientId!,
          clientSecret: githubClientSecret!,
          // Least-privilege: grants 5,000 req/hr for reading all public repos/issues/PRs
          // without requesting write access to user repositories.
          scope: ['read:user', 'user:email'],
        },
      }
    : {},
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ['github'],
    },
  },
  databaseHooks: {
    account: {
      create: {
        after: async (acc) => {
          await syncEncryptedGithubAccount(acc)
        },
      },
      update: {
        after: async (acc) => {
          await syncEncryptedGithubAccount(acc)
        },
      },
    },
  },
  plugins: [
    // Must be the last plugin for TanStack Start cookie handling
    tanstackStartCookies(),
  ],
})

export type AuthSession = typeof auth.$Infer.Session
