import { createFileRoute } from '@tanstack/react-router'
import { toHttpErrorResponse } from '#/server/errors'
import { requireApiAuth } from '#/server/middleware/auth'
import {
  addRepositoryForUser,
  listUserRepositories,
} from '#/server/services/repository.service'
import { addRepositorySchema } from '#/shared/schemas'

export const Route = createFileRoute('/api/v1/repositories')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { userId } = await requireApiAuth(request)
          const repos = await listUserRepositories(userId)
          return Response.json({ repositories: repos })
        } catch (err) {
          return toHttpErrorResponse(err)
        }
      },
      POST: async ({ request }) => {
        try {
          const { userId } = await requireApiAuth(request)
          const body: unknown = await request.json()
          const input = addRepositorySchema.parse(body)
          const result = await addRepositoryForUser(userId, input)
          return Response.json(result, {
            status: result.alreadyTracked ? 200 : 201,
          })
        } catch (err) {
          return toHttpErrorResponse(err)
        }
      },
    },
  },
})
