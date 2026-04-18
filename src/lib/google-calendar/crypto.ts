import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const KEY_LEN = 32
const SALT = 'take2ems-gcal-v1'

function deriveKey(): Buffer {
  const secret = (process.env.GOOGLE_TOKEN_SECRET || process.env.JWT_SECRET || '').trim()
  if (secret.length < 16) {
    throw new Error('GOOGLE_TOKEN_SECRET (or JWT_SECRET) muss mindestens 16 Zeichen haben.')
  }
  return scryptSync(secret, SALT, KEY_LEN)
}

export function encryptRefreshToken(plain: string): string {
  const iv = randomBytes(12)
  const key = deriveKey()
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptRefreshToken(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64url')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const key = deriveKey()
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
