import '@fastify/jwt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Redis } from 'ioredis'
import type { Mongoose } from 'mongoose'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      email: string
      jti: string
    }
    user: {
      id: string
      email: string
      jti: string
      exp: number
      iat: number
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
    mongoose: Mongoose
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
