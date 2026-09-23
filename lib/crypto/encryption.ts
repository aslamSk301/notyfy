/**
 * Edge & Cloudflare Worker compatible AES-256-GCM encryption utilities.
 * Uses Web Crypto API (`crypto.subtle`) available natively in Node.js 18+ and Cloudflare Workers.
 */

function getSecretKeyString(): string {
  // Use custom ENCRYPTION_KEY if set, otherwise fallback to BETTER_AUTH_SECRET or JWT_SECRET
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.JWT_SECRET ||
    'local-dev-fallback-encryption-secret-32-chars-long'

  return secret
}

/** Derive a 256-bit AES-GCM CryptoKey using SHA-256 digest of the master secret */
async function getCryptoKey(): Promise<CryptoKey> {
  const secret = getSecretKeyString()
  const encoder = new TextEncoder()
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret))

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a plaintext string into an AES-256-GCM ciphertext.
 * Output format: Base64 string containing [12 bytes IV + ciphertext with authTag]
 */
export async function encryptText(plainText: string): Promise<string> {
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const encodedText = encoder.encode(plainText)

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedText
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const combined = new Uint8Array(iv.length + encryptedBytes.length)
  combined.set(iv, 0)
  combined.set(encryptedBytes, iv.length)

  return Buffer.from(combined).toString('base64')
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext back into plaintext.
 */
export async function decryptText(cipherTextBase64: string): Promise<string> {
  const key = await getCryptoKey()
  const combined = Buffer.from(cipherTextBase64, 'base64')

  if (combined.length < 12 + 16) {
    throw new Error('Invalid ciphertext length')
  }

  const iv = combined.subarray(0, 12)
  const encryptedBytes = combined.subarray(12)

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encryptedBytes
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}
