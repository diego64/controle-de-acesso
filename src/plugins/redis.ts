import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { Redis } from 'ioredis'
import { env } from '@/config/env.js'

async function redisPlugin(app: FastifyInstance): Promise<void> {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  })

  client.on('error', (err: Error) => {
    app.log.error({ err }, 'redis error')
  })

  await client.ping()
  app.decorate('redis', client)
  app.log.info('redis connected')

  app.addHook('onClose', async () => {
    await client.quit()
    app.log.info('redis disconnected')
  })
}

export default fp(redisPlugin, { name: 'redis' })
