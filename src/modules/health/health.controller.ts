import type { FastifyInstance } from 'fastify'
import { liveFastifySchema, readyFastifySchema } from './health.schema.js'

type ServiceStatus = 'ok' | 'down'

export function healthRoutes(app: FastifyInstance): void {
  app.get('/live', { schema: liveFastifySchema }, (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/ready', { schema: readyFastifySchema }, async (_request, reply) => {
    const [mongodb, redis] = await Promise.all([
      pingMongo(app),
      pingRedis(app),
    ])
    const allOk = mongodb === 'ok' && redis === 'ok'
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'down',
      services: { mongodb, redis },
      timestamp: new Date().toISOString(),
    })
  })
}

async function pingMongo(app: FastifyInstance): Promise<ServiceStatus> {
  try {
    const db = app.mongoose.connection.db
    if (!db) return 'down'
    await db.admin().ping()
    return 'ok'
  } catch {
    return 'down'
  }
}

async function pingRedis(app: FastifyInstance): Promise<ServiceStatus> {
  try {
    const result = await app.redis.ping()
    return result === 'PONG' ? 'ok' : 'down'
  } catch {
    return 'down'
  }
}
