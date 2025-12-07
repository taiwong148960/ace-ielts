/**
 * Encryption utilities for Edge Functions
 * Uses Web Crypto API (AES-GCM) for secure encryption
 */

import { createLogger } from "./logger.ts"

const logger = createLogger("crypto")

// Declare Deno global for TypeScript
declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

/**
 * Get encryption key from environment
 * Falls back to a default key for development (NOT secure for production)
 */
function getEncryptionKey(): string {
  const key = Deno.env.get("ENCRYPTION_KEY")
  if (!key) {
    logger.warn("ENCRYPTION_KEY not set, using development fallback (NOT SECURE)")
    // Development fallback - MUST be set in production
    return "ace-ielts-dev-encryption-key-32ch"
  }
  return key
}

/**
 * Derive a crypto key from a string password
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("ace-ielts-salt-v1"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/**
 * Encrypt a string using AES-GCM
 * Returns a base64-encoded string containing IV + ciphertext
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey())
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  )

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a string that was encrypted with encrypt()
 * Expects a base64-encoded string containing IV + ciphertext
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey())
  
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Check if a string appears to be encrypted with our encryption scheme
 * (base64-encoded, minimum length for IV + some ciphertext)
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 20) return false
  try {
    const decoded = atob(value)
    return decoded.length >= 13 // At least 12 bytes IV + 1 byte ciphertext
  } catch {
    return false
  }
}

/**
 * Safely encrypt, handling null/undefined values
 */
export async function safeEncrypt(value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  return encrypt(value)
}

/**
 * Safely decrypt, handling null/undefined values and legacy base64 encoding
 */
export async function safeDecrypt(value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  
  try {
    // Try to decrypt with AES-GCM
    return await decrypt(value)
  } catch (error) {
    // Fallback: might be legacy base64 encoding
    try {
      return atob(value)
    } catch {
      logger.error("Failed to decrypt value", {}, error as Error)
      return null
    }
  }
}
