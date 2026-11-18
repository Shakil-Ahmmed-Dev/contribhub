import type { GithubRefType } from './constants'

export interface ParsedGithubRepo {
  owner: string
  name: string
  fullName: string
  normalizedFullName: string
  url: string
}

export interface ParsedGithubEntity extends ParsedGithubRepo {
  entityType: 'repository' | GithubRefType
  number?: number
  sha?: string
  entityUrl: string
  normalizedEntityUrl: string
}

const VALID_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/
const VALID_REPO_REGEX = /^[a-zA-Z0-9._-]{1,100}$/

function cleanRepoName(raw: string): string {
  return raw.replace(/\.git$/i, '')
}

function isValidOwnerAndRepo(owner: string, name: string): boolean {
  if (!VALID_OWNER_REGEX.test(owner) || !VALID_REPO_REGEX.test(name)) {
    return false
  }
  if (name === '.' || name === '..') return false
  return true
}

/**
 * Parses a GitHub repository identifier (`owner/repo`, `https://github.com/owner/repo`,
 * or any issue/PR/discussion/commit URL inside that repository).
 */
export function parseGithubUrl(input: string): ParsedGithubEntity | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Shorthand format: owner/repo (optionally with #123)
  if (!trimmed.includes('://') && !trimmed.startsWith('github.com')) {
    const shorthandMatch = /^([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)(?:#(\d+))?$/.exec(
      trimmed.replace(/^\/+|\/+$/g, ''),
    )
    if (!shorthandMatch) return null
    const owner = shorthandMatch[1]
    const name = cleanRepoName(shorthandMatch[2])
    const num = shorthandMatch[3] ? Number(shorthandMatch[3]) : undefined
    if (!isValidOwnerAndRepo(owner, name)) return null

    const fullName = `${owner}/${name}`
    const normalizedFullName = fullName.toLowerCase()
    const repoUrl = `https://github.com/${fullName}`

    if (num) {
      const entityUrl = `${repoUrl}/issues/${num}`
      return {
        owner,
        name,
        fullName,
        normalizedFullName,
        url: repoUrl,
        entityType: 'issue',
        number: num,
        entityUrl,
        normalizedEntityUrl: entityUrl.toLowerCase(),
      }
    }

    return {
      owner,
      name,
      fullName,
      normalizedFullName,
      url: repoUrl,
      entityType: 'repository',
      entityUrl: repoUrl,
      normalizedEntityUrl: repoUrl.toLowerCase(),
    }
  }

  // URL format
  const withScheme = trimmed.startsWith('github.com')
    ? `https://${trimmed}`
    : trimmed

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  if (host !== 'github.com' && host !== 'www.github.com') {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null

  const owner = segments[0]
  const name = cleanRepoName(segments[1])
  if (!isValidOwnerAndRepo(owner, name)) return null

  const fullName = `${owner}/${name}`
  const normalizedFullName = fullName.toLowerCase()
  const repoUrl = `https://github.com/${fullName}`

  if (segments.length >= 4) {
    const section = segments[2].toLowerCase()
    const target = segments[3]

    if (section === 'issues' && /^\d+$/.test(target)) {
      const number = Number(target)
      const entityUrl = `${repoUrl}/issues/${number}`
      return {
        owner,
        name,
        fullName,
        normalizedFullName,
        url: repoUrl,
        entityType: 'issue',
        number,
        entityUrl,
        normalizedEntityUrl: entityUrl.toLowerCase(),
      }
    }

    if ((section === 'pull' || section === 'pulls') && /^\d+$/.test(target)) {
      const number = Number(target)
      const entityUrl = `${repoUrl}/pull/${number}`
      return {
        owner,
        name,
        fullName,
        normalizedFullName,
        url: repoUrl,
        entityType: 'pull_request',
        number,
        entityUrl,
        normalizedEntityUrl: entityUrl.toLowerCase(),
      }
    }

    if (section === 'discussions' && /^\d+$/.test(target)) {
      const number = Number(target)
      const entityUrl = `${repoUrl}/discussions/${number}`
      return {
        owner,
        name,
        fullName,
        normalizedFullName,
        url: repoUrl,
        entityType: 'discussion',
        number,
        entityUrl,
        normalizedEntityUrl: entityUrl.toLowerCase(),
      }
    }

    if (section === 'commit' && /^[0-9a-f]{7,40}$/i.test(target)) {
      const sha = target.toLowerCase()
      const entityUrl = `${repoUrl}/commit/${sha}`
      return {
        owner,
        name,
        fullName,
        normalizedFullName,
        url: repoUrl,
        entityType: 'commit',
        sha,
        entityUrl,
        normalizedEntityUrl: entityUrl.toLowerCase(),
      }
    }
  }

  return {
    owner,
    name,
    fullName,
    normalizedFullName,
    url: repoUrl,
    entityType: 'repository',
    entityUrl: repoUrl,
    normalizedEntityUrl: repoUrl.toLowerCase(),
  }
}

export function normalizeUrl(rawUrl: string): string {
  const github = parseGithubUrl(rawUrl)
  if (github) {
    return github.normalizedEntityUrl
  }
  try {
    const parsed = new URL(rawUrl.trim())
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return rawUrl.trim().toLowerCase()
  }
}
