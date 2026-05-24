import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '@/config/env.js'

const SALT_BYTES = 32
const SEPARATOR = ':'

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const hash = pbkdf2Sync(
    plain,
    salt,
    env.HASH_ITERATIONS,
    env.HASH_KEYLEN,
    env.HASH_DIGEST,
  ).toString('hex')
  return `${hash}${SEPARATOR}${salt}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(SEPARATOR)
  if (parts.length !== 2) {
    return false
  }
  const [hash, salt] = parts
  if (!hash || !salt) {
    return false
  }

  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== env.HASH_KEYLEN) {
    return false
  }

  const attempt = pbkdf2Sync(
    plain,
    salt,
    env.HASH_ITERATIONS,
    env.HASH_KEYLEN,
    env.HASH_DIGEST,
  )

  return timingSafeEqual(attempt, expected)
}
