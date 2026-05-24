import type { FastifyServerOptions } from 'fastify'
import { env } from '@/config/env.js'

type LoggerOptions = NonNullable<FastifyServerOptions['logger']>

export function buildLoggerOptions(): LoggerOptions {
  const redactPaths = [
    'req.headers.authorization',
    'req.headers.Authorization',
    'req.headers.cookie',
    '*.password',
    '*.passwordHash',
    '*.token',
    '*.jwt',
  ]

  if (env.NODE_ENV === 'development') {
    return {
      level: env.LOG_LEVEL,
      redact: { paths: redactPaths, censor: '[Redacted]' },
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    }
  }

  return {
    level: env.LOG_LEVEL,
    redact: { paths: redactPaths, censor: '[Redacted]' },
  }
}
