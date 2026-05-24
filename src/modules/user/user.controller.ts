import type { FastifyInstance } from 'fastify'
import { createRequireRole } from '@/middlewares/requireRole.js'
import { MongoUserRepository } from './user.repository.js'
import { listUsersFastifySchema } from './user.schema.js'

export function userRoutes(app: FastifyInstance): void {
  const repo = new MongoUserRepository()
  const requireRole = createRequireRole(repo)

  app.get(
    '/',
    {
      schema: listUsersFastifySchema,
      preHandler: [app.authenticate, requireRole('ADMINISTRADOR')],
    },
    async (_request, reply) => {
      const users = await repo.findAll()
      return reply.send(users)
    },
  )
}
