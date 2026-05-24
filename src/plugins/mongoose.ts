import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import mongoose from 'mongoose'
import { env } from '@/config/env.js'

// Cache global de conexão — necessário para Vercel Serverless reutilizar o
// socket entre invocações e não estourar o limite do Atlas.
declare global {
  var __mongooseConn: Promise<typeof mongoose> | undefined
}

async function mongoosePlugin(app: FastifyInstance): Promise<void> {
  if (!global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5_000,
    })
  }

  const conn = await global.__mongooseConn
  app.decorate('mongoose', conn)
  app.log.info({ db: conn.connection.name }, 'mongo connected')

  app.addHook('onClose', async () => {
    if (env.NODE_ENV !== 'production') {
      await conn.disconnect()
      global.__mongooseConn = undefined
      app.log.info('mongo disconnected')
    }
  })
}

export default fp(mongoosePlugin, { name: 'mongoose' })
