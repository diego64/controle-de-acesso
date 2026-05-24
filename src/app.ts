import Fastify, { type FastifyInstance } from 'fastify'
// fastify-metrics é publicado como CJS com `export default`; sob NodeNext
// o default-import resolve para o namespace, então acessamos .default.
import metricsModule from 'fastify-metrics'
const metricsPlugin = metricsModule.default
import { authRoutes } from '@/modules/auth/auth.controller.js'
import { healthRoutes } from '@/modules/health/health.controller.js'
import { userRoutes } from '@/modules/user/user.controller.js'
import errorHandlerPlugin from '@/plugins/errorHandler.js'
import jwtPlugin from '@/plugins/jwt.js'
import { buildLoggerOptions } from '@/plugins/logger.js'
import mongoosePlugin from '@/plugins/mongoose.js'
import rateLimitPlugin from '@/plugins/rateLimit.js'
import redisPlugin from '@/plugins/redis.js'

export interface BuildAppOptions {
  testing?: boolean
}

export async function buildApp(
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(),
    disableRequestLogging: opts.testing === true,
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  })

  await app.register(errorHandlerPlugin)

  await app.register(mongoosePlugin)
  await app.register(redisPlugin)
  await app.register(rateLimitPlugin)
  await app.register(jwtPlugin)

  // fastify-metrics deve vir ANTES das rotas para hookar onRequest/onResponse
  // por rota. Expõe GET /metrics no formato Prometheus (default endpoint).
  await app.register(metricsPlugin, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
    // Limpa registry global do prom-client antes de registrar — necessário
    // para testes E2E que constroem múltiplas instâncias de app no mesmo
    // processo (singleFork). Em produção o registry está vazio no boot,
    // então clear é no-op.
    clearRegisterOnInit: true,
  })

  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(userRoutes, { prefix: '/users' })

  return app
}
