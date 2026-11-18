import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const KEY_LENGTH_BYTES = 32

export interface EncryptedTokenPayload {
  encryptedAccessToken: string
  tokenIv: string
  tokenAuthTag: string
  keyVersion: number
}

function getEncryptionKey(): Buffer {
  const rawKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY
  if (!rawKey) {
    throw new Error(
      'GITHUB_TOKEN_ENCRYPTION_KEY is not configured. Provide a 64-character hex string.',
    )
  }

  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }

  // Fallback: derive deterministic 32-byte key from arbitrary passphrase if non-hex in dev
  return crypto.createHash('sha256').update(rawKey).digest().subarray(0, KEY_LENGTH_BYTES)
}

export function encryptSecret(plaintext: string, keyVersion = 1): EncryptedTokenPayload {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return {
    encryptedAccessToken: encrypted.toString('base64'),
    tokenIv: iv.toString('base64'),
    tokenAuthTag: authTag.toString('base64'),
    keyVersion,
  }
}

export function decryptSecret(payload: {
  encryptedAccessToken: string
  tokenIv: string
  tokenAuthTag: string
}): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(payload.tokenIv, 'base64')
  const authTag = Buffer.from(payload.tokenAuthTag, 'base64')
  const ciphertext = Buffer.from(payload.encryptedAccessToken, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function generateApiToken(): {
  rawToken: string
  tokenPrefix: string
  tokenHash: string
} {
  const randomPart = crypto.randomBytes(24).toString('base64url')
  const rawToken = `ch_${randomPart}`
  const tokenPrefix = rawToken.slice(0, 10)
  const tokenHash = hashApiToken(rawToken)
  return { rawToken, tokenPrefix, tokenHash }
}

export function hashApiToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}
