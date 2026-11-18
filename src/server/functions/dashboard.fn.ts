import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '#/server/middleware/auth'
import { getDashboardSummary } from '#/server/services/contribution.service'
import { getGithubConnectionStatus } from '#/server/services/github.service'

export const getDashboardSummaryFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userId } = await requireSession()
    const [summary, github] = await Promise.all([
      getDashboardSummary(userId),
      getGithubConnectionStatus(userId),
    ])
    return { ...summary, githubConnected: github.connected }
  },
)
