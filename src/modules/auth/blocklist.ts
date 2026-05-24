import type { Redis } from 'ioredis'

export const BLOCKLIST_KEY_PREFIX = 'blocklist:'

export interface Blocklist {
  add(jti: string, ttlSeconds: number): Promise<void>
  has(jti: string): Promise<boolean>
}

export function createRedisBlocklist(redis: Redis): Blocklist {
  return {
    async add(jti, ttlSeconds) {
      if (ttlSeconds <= 0) {
        return
      }
      await redis.set(`${BLOCKLIST_KEY_PREFIX}${jti}`, '1', 'EX', ttlSeconds)
    },
    async has(jti) {
      const exists = await redis.exists(`${BLOCKLIST_KEY_PREFIX}${jti}`)
      return exists === 1
    },
  }
}
