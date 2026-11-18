import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '#/server/middleware/auth'
import { globalSearch } from '#/server/services/search.service'

export const globalSearchFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ query: z.string().max(200) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return globalSearch(userId, data.query)
  })
