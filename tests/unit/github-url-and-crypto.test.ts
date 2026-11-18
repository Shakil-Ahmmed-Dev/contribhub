import { describe, expect, it } from 'vitest'
import { normalizeUrl, parseGithubUrl } from '#/shared/github-url'
import { decryptSecret, encryptSecret, generateApiToken, hashApiToken } from '#/server/crypto'

describe('parseGithubUrl & normalizeUrl', () => {
  it('parses owner/repo shorthand', () => {
    const parsed = parseGithubUrl('TanStack/router')
    expect(parsed).toEqual({
      owner: 'TanStack',
      name: 'router',
      fullName: 'TanStack/router',
      normalizedFullName: 'tanstack/router',
      url: 'https://github.com/TanStack/router',
      entityType: 'repository',
      entityUrl: 'https://github.com/TanStack/router',
      normalizedEntityUrl: 'https://github.com/tanstack/router',
    })
  })

  it('parses repository URL with trailing .git and slash', () => {
    const parsed = parseGithubUrl('https://github.com/facebook/react.git/')
    expect(parsed?.fullName).toBe('facebook/react')
    expect(parsed?.entityType).toBe('repository')
  })

  it('parses GitHub issue URL', () => {
    const parsed = parseGithubUrl('https://github.com/drizzle-team/drizzle-orm/issues/4201')
    expect(parsed?.entityType).toBe('issue')
    expect(parsed?.number).toBe(4201)
    expect(parsed?.normalizedEntityUrl).toBe(
      'https://github.com/drizzle-team/drizzle-orm/issues/4201',
    )
  })

  it('parses GitHub pull request URL', () => {
    const parsed = parseGithubUrl('https://github.com/vercel/next.js/pull/98765/files')
    expect(parsed?.entityType).toBe('pull_request')
    expect(parsed?.number).toBe(98765)
    expect(parsed?.entityUrl).toBe('https://github.com/vercel/next.js/pull/98765')
  })

  it('parses GitHub discussion and commit URLs', () => {
    const disc = parseGithubUrl('https://github.com/TanStack/query/discussions/123')
    expect(disc?.entityType).toBe('discussion')
    expect(disc?.number).toBe(123)

    const commit = parseGithubUrl(
      'https://github.com/vitejs/vite/commit/abcdef1234567890',
    )
    expect(commit?.entityType).toBe('commit')
    expect(commit?.sha).toBe('abcdef1234567890')
  })

  it('rejects non-GitHub or malformed inputs', () => {
    expect(parseGithubUrl('https://gitlab.com/org/repo')).toBeNull()
    expect(parseGithubUrl('not a repo')).toBeNull()
    expect(parseGithubUrl('')).toBeNull()
  })

  it('normalizes URLs consistently regardless of case or trailing slashes', () => {
    expect(normalizeUrl('https://github.com/TanStack/Router/issues/10/')).toBe(
      'https://github.com/tanstack/router/issues/10',
    )
  })
})

describe('AES-256-GCM secret encryption & API tokens', () => {
  it('encrypts and decrypts GitHub tokens with unique IVs and detects tampering', () => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

    const plaintext = 'gho_superSecretOAuthToken123456'
    const enc1 = encryptSecret(plaintext)
    const enc2 = encryptSecret(plaintext)

    expect(enc1.encryptedAccessToken).not.toBe(plaintext)
    expect(enc1.tokenIv).not.toBe(enc2.tokenIv)
    expect(decryptSecret(enc1)).toBe(plaintext)
    expect(decryptSecret(enc2)).toBe(plaintext)

    // Tampering with ciphertext must fail GCM authentication
    expect(() =>
      decryptSecret({
        ...enc1,
        encryptedAccessToken: Buffer.from('tampered-data').toString('base64'),
      }),
    ).toThrow()
  })

  it('generates prefixed API tokens and hashes deterministically', () => {
    const token = generateApiToken()
    expect(token.rawToken.startsWith('ch_')).toBe(true)
    expect(token.tokenPrefix).toBe(token.rawToken.slice(0, 10))
    expect(hashApiToken(token.rawToken)).toBe(token.tokenHash)
  })
})
