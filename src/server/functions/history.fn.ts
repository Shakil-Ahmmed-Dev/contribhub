import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '#/server/middleware/auth'
import { getContributionHistory } from '#/server/services/history.service'

export const getContributionHistoryFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { userId } = await requireSession()
  return getContributionHistory(userId)
})
