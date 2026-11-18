import { createFileRoute } from '@tanstack/react-router'
import { toHttpErrorResponse } from '#/server/errors'
import { requireApiAuth } from '#/server/middleware/auth'
import {
  createContribution,
  findDuplicateContributionsByUrl,
  listContributions,
} from '#/server/services/contribution.service'
import { fetchPublicGithubEntity } from '#/server/services/github.service'
import { parseGithubUrl } from '#/shared/github-url'
import { quickCaptureApiSchema } from '#/shared/schemas'

export const Route = createFileRoute('/api/v1/contributions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { userId } = await requireApiAuth(request)
          const url = new URL(request.url)
          const lookupUrl = url.searchParams.get('lookupUrl')

          if (lookupUrl) {
            const matches = await findDuplicateContributionsByUrl(
              userId,
              lookupUrl,
            )
            return Response.json({ duplicates: matches })
          }

          const search = url.searchParams.get('search') ?? undefined
          const result = await listContributions(userId, { search, pageSize: 50 })
          return Response.json(result)
        } catch (err) {
          return toHttpErrorResponse(err)
        }
      },

      POST: async ({ request }) => {
        try {
          const { userId } = await requireApiAuth(request)
          const body: unknown = await request.json()
          const parsedInput = quickCaptureApiSchema.parse(body)

          const duplicates = await findDuplicateContributionsByUrl(
            userId,
            parsedInput.url,
          )
          const parsedGh = parseGithubUrl(parsedInput.url)

          let title = parsedInput.title?.trim()
          let contributionType = parsedInput.contributionType

          if (!title && parsedGh && parsedGh.entityType !== 'repository') {
            try {
              const fetched = await fetchPublicGithubEntity(parsedGh, { userId })
              if (!fetched.notModified) {
                title = fetched.data.title
              }
            } catch {
              // Fallback title below
            }
            if (!contributionType) {
              contributionType =
                parsedGh.entityType === 'issue'
                  ? 'existing_issue'
                  : 'bug_or_improvement'
            }
          }

          const resolvedTitle =
            title ||
            (parsedGh
              ? `${parsedGh.fullName}${parsedGh.number ? ` #${parsedGh.number}` : ''}`
              : parsedInput.url)

          const created = await createContribution(userId, {
            title: resolvedTitle,
            repositoryIdentifier: parsedGh?.fullName,
            githubIssueUrl:
              parsedGh && parsedGh.entityType !== 'repository'
                ? parsedGh.entityUrl
                : undefined,
            sourceUrl: parsedInput.url,
            contributionType: contributionType ?? 'bug_or_improvement',
            priority: parsedInput.priority,
            personalStatus: parsedInput.personalStatus,
            initialNote: parsedInput.note,
          })

          return Response.json(
            {
              contribution: created,
              existingDuplicates: duplicates,
            },
            { status: 201 },
          )
        } catch (err) {
          return toHttpErrorResponse(err)
        }
      },
    },
  },
})
