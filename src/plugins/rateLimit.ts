import fastifyRateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

// Plugin registrado com `global: false` para que cada rota opte-in via
// `config: { rateLimit: { max, timeWindow } }`. Rotas sensíveis (login,
// register) DEVEM aplicar config.rateLimit conforme docs/security.md.
async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyRateLimit, {
    global: false,
    redis: app.redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Limite de tentativas excedido. Aguarde ${context.after}.`,
    }),
  })
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['redis'],
})
