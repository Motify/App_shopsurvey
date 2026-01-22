import crypto from 'crypto'

// Use AES-256-GCM encryption
// Key stored in environment variable, only on server
const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.IDENTITY_ENCRYPTION_KEY
  if (!key) {
    throw new Error('IDENTITY_ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'base64')
}

/**
 * Encrypts a plaintext identity (email or employee ID) using AES-256-GCM
 * Returns base64-encoded string containing: IV (16 bytes) + AuthTag (16 bytes) + Encrypted data
 */
export function encryptIdentity(plaintext: string): string | null {
  if (!plaintext) return null

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine iv + authTag + encrypted data
  return Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ]).toString('base64')
}

/**
 * Decrypts an encrypted identity string
 * Expects base64-encoded string containing: IV (16 bytes) + AuthTag (16 bytes) + Encrypted data
 */
export function decryptIdentity(encryptedData: string): string | null {
  if (!encryptedData) return null

  const key = getEncryptionKey()
  const data = Buffer.from(encryptedData, 'base64')

  const iv = data.subarray(0, 16)
  const authTag = data.subarray(16, 32)
  const encrypted = data.subarray(32)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generates a new encryption key (run once, store in environment variables)
 * Usage: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64')
}
