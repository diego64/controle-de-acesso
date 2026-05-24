import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Blocklist } from '@/modules/auth/blocklist.js'
import { AppError } from '@/shared/errors/AppError.js'

export type Authenticate = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>

export function createAuthenticate(blocklist: Blocklist): Authenticate {
  return async (request, _reply) => {
    const header = request.headers.authorization
    if (!header) {
      throw new AppError('TOKEN_MISSING', 401)
    }

    try {
      await request.jwtVerify()
    } catch (err: unknown) {
      const code =
        err instanceof Error && err.message.toLowerCase().includes('expired')
          ? 'TOKEN_EXPIRED'
          : 'TOKEN_INVALID'
      const status = code === 'TOKEN_EXPIRED' ? 403 : 401
      throw new AppError(code, status)
    }

    if (await blocklist.has(request.user.jti)) {
      throw new AppError('TOKEN_REVOKED', 401)
    }
  }
}
