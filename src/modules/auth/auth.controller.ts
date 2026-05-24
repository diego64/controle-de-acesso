import type { FastifyInstance } from 'fastify'
import { MongoUserRepository } from '@/modules/user/user.repository.js'
import { AppError } from '@/shared/errors/AppError.js'
import { createRedisBlocklist } from './blocklist.js'
import {
  loginFastifySchema,
  meFastifySchema,
  registerFastifySchema,
  type LoginBody,
  type RegisterBody,
} from './auth.schema.js'
import { loginUser, logoutUser, registerUser } from './auth.service.js'
import type { SignToken } from './auth.types.js'

export function authRoutes(app: FastifyInstance): void {
  const repo = new MongoUserRepository()
  const sign: SignToken = (payload) => app.jwt.sign(payload)
  const blocklist = createRedisBlocklist(app.redis)

  app.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: registerFastifySchema,
      config: { rateLimit: { max: 5, timeWindow: '1m' } },
    },
    async (request, reply) => {
      const result = await registerUser(repo, request.body)
      return reply.status(201).send(result)
    },
  )

  app.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: loginFastifySchema,
      config: { rateLimit: { max: 10, timeWindow: '1m' } },
    },
    async (request, reply) => {
      const result = await loginUser(repo, sign, request.body)
      return reply.send(result)
    },
  )

  app.get(
    '/me',
    {
      schema: meFastifySchema,
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = await repo.findById(request.user.id)
      if (!user) {
        throw new AppError('TOKEN_REVOKED', 401)
      }
      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
      })
    },
  )

  app.post(
    '/logout',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      await logoutUser(blocklist, {
        jti: request.user.jti,
        exp: request.user.exp,
      })
      return reply.status(204).send()
    },
  )
}
