import { createServerFn } from '@tanstack/react-start'
import { isGithubOAuthConfigured } from '#/server/auth'
import { getOptionalSession } from '#/server/middleware/auth'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getOptionalSession()
    return {
      authenticated: Boolean(session),
      user: session?.user ?? null,
      githubOAuthEnabled: isGithubOAuthConfigured,
    }
  },
)
