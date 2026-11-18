import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '#/server/middleware/auth'
import {
  createContribution,
  deleteContribution,
  findDuplicateContributionsByUrl,
  getContributionDetail,
  listContributions,
  moveContributionStatus,
  updateContribution,
} from '#/server/services/contribution.service'
import {
  createContributionSchema,
  listContributionsFilterSchema,
  moveContributionStatusSchema,
  updateContributionSchema,
} from '#/shared/schemas'

export const listContributionsFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => listContributionsFilterSchema.optional().parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return listContributions(userId, data ?? {})
  })

export const getContributionDetailFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ contributionId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return getContributionDetail(userId, data.contributionId)
  })

export const createContributionFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => createContributionSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return createContribution(userId, data)
  })

export const updateContributionFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => updateContributionSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return updateContribution(userId, data)
  })

export const moveContributionStatusFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => moveContributionStatusSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return moveContributionStatus(userId, data)
  })

export const deleteContributionFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z.object({ contributionId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return deleteContribution(userId, data.contributionId)
  })

export const checkDuplicateGithubUrlFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => z.object({ url: z.string().trim().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return findDuplicateContributionsByUrl(userId, data.url)
  })
