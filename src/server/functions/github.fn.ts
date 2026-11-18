import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isGithubOAuthConfigured } from '#/server/auth'
import { requireSession } from '#/server/middleware/auth'
import {
  disconnectGithubAccount,
  fetchPublicGithubEntity,
  fetchPublicRepositoryMetadata,
  getGithubConnectionStatus,
  linkGithubReference,
  listUserPullRequests,
  syncAllOpenReferences,
  syncGithubReference,
  unlinkGithubReference,
} from '#/server/services/github.service'
import { parseGithubUrl } from '#/shared/github-url'
import { linkGithubReferenceSchema } from '#/shared/schemas'
import { ValidationError } from '#/server/errors'

export const getGithubConnectionStatusFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { userId } = await requireSession()
  const status = await getGithubConnectionStatus(userId)
  return {
    ...status,
    oauthConfigured: isGithubOAuthConfigured,
  }
})

export const disconnectGithubFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { userId } = await requireSession()
    return disconnectGithubAccount(userId)
  },
)

export const lookupGithubUrlFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ url: z.string().trim().min(3) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    const parsed = parseGithubUrl(data.url)
    if (!parsed) {
      throw new ValidationError('Invalid GitHub URL or owner/repo identifier')
    }

    if (parsed.entityType === 'repository') {
      const repoRes = await fetchPublicRepositoryMetadata(
        parsed.owner,
        parsed.name,
        { userId },
      )
      return {
        parsed,
        repository: repoRes.notModified ? null : repoRes.data,
        entity: null,
      }
    }

    const [repoRes, entityRes] = await Promise.all([
      fetchPublicRepositoryMetadata(parsed.owner, parsed.name, { userId }).catch(
        () => null,
      ),
      fetchPublicGithubEntity(parsed, { userId }),
    ])

    return {
      parsed,
      repository: repoRes && !repoRes.notModified ? repoRes.data : null,
      entity: entityRes.notModified ? null : entityRes.data,
    }
  })

export const linkGithubReferenceFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => linkGithubReferenceSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return linkGithubReference(userId, data)
  })

export const unlinkGithubReferenceFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return unlinkGithubReference(userId, data.id)
  })

export const syncGithubReferenceFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return syncGithubReference(userId, data.id)
  })

export const syncAllOpenReferencesFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  const { userId } = await requireSession()
  return syncAllOpenReferences(userId)
})

export const listUserPullRequestsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userId } = await requireSession()
    return listUserPullRequests(userId)
  },
)
