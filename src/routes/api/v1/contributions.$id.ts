import { createFileRoute } from '@tanstack/react-router'
import { toHttpErrorResponse } from '#/server/errors'
import { requireApiAuth } from '#/server/middleware/auth'
import {
  getContributionDetail,
  updateContribution,
} from '#/server/services/contribution.service'
import { updateContributionSchema } from '#/shared/schemas'

export const Route = createFileRoute('/api/v1/contributions/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const { userId } = await requireApiAuth(request)
          const detail = await getContributionDetail(userId, params.id)
          return Response.json(detail)
        } catch (err) {
          return toHttpErrorResponse(err)
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const { userId } = await requireApiAuth(request)
          const body = (await request.json()) as Record<string, unknown>
          const input = updateContributionSchema.parse({
            ...body,
            id: params.id,
          })
          const updated = await updateContribution(userId, input)
          return Response.json({ contribution: updated })
        } catch (err) {
          return toHttpErrorResponse(err)
        }
      },
    },
  },
})
