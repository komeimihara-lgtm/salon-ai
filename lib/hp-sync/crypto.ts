/**
 * AES-256-GCM encryption helpers for HP login credentials.
 *
 * HP_ENCRYPTION_KEY must be a 32-byte value hex-encoded (64 hex chars).
 * Generate once with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Format of stored ciphertext:  "<ivHex>:<tagHex>:<dataHex>"
 */

import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const hex = process.env.HP_ENCRYPTION_KEY
  if (!hex) {
    throw new Error('HP_ENCRYPTION_KEY is not configured')
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error('HP_ENCRYPTION_KEY must be 32 bytes hex-encoded (64 chars)')
  }
  return buf
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return ''
  const parts = payload.split(':')
  if (parts.length !== 3) return ''
  const [ivHex, tagHex, dataHex] = parts
  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ])
    return dec.toString('utf8')
  } catch {
    return ''
  }
}

/** Returns a masked representation like  "●●●●●●●ab"  (last 2 chars visible) */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return ''
  if (plaintext.length <= 2) return '●'.repeat(plaintext.length)
  return '●'.repeat(Math.max(6, plaintext.length - 2)) + plaintext.slice(-2)
}
