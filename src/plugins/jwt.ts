import fastifyJwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { env } from '@/config/env.js'
import { createAuthenticate } from '@/middlewares/authenticate.js'
import { createRedisBlocklist } from '@/modules/auth/blocklist.js'

async function jwtPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
    formatUser: (payload) => {
      const claims = payload as typeof payload & { exp: number; iat: number }
      return {
        id: claims.sub,
        email: claims.email,
        jti: claims.jti,
        exp: claims.exp,
        iat: claims.iat,
      }
    },
  })

  const blocklist = createRedisBlocklist(app.redis)
  app.decorate('authenticate', createAuthenticate(blocklist))
}

export default fp(jwtPlugin, { name: 'jwt', dependencies: ['redis'] })
