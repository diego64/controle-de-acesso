import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";
// fastify-metrics é publicado como CJS com `export default`; sob NodeNext
// o default-import resolve para o namespace, então acessamos .default.
import metricsModule from "fastify-metrics";
const metricsPlugin = metricsModule.default;
import { env } from "@/config/env.js";
import { authRoutes } from "@/modules/auth/auth.controller.js";
import { healthRoutes } from "@/modules/health/health.controller.js";
import { userRoutes } from "@/modules/user/user.controller.js";
import errorHandlerPlugin from "@/plugins/errorHandler.js";
import jwtPlugin from "@/plugins/jwt.js";
import { buildLoggerOptions } from "@/plugins/logger.js";
import mongoosePlugin from "@/plugins/mongoose.js";
import rateLimitPlugin from "@/plugins/rateLimit.js";
import redisPlugin from "@/plugins/redis.js";

export interface BuildAppOptions {
  testing?: boolean;
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
  });

  await app.register(errorHandlerPlugin);

  // Security headers em TODAS as responses (inclusive 4xx/5xx).
  // Defaults do helmet: X-Content-Type-Options, X-Frame-Options, HSTS,
  // X-DNS-Prefetch-Control, Referrer-Policy, etc.
  await app.register(fastifyHelmet, {
    // CSP em API JSON costuma ser desnecessária; mantemos defaults estritos
    // (sem inline scripts permitidos — irrelevante pra API mas defensivo).
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
      },
    },
  });

  // CORS — só registra se CORS_ORIGIN explicitamente definido.
  // docs/security.md proíbe origin:'*' em produção; default vazio = sem CORS
  // (acesso a partir de clientes não-browser permanece OK).
  if (env.CORS_ORIGIN) {
    const origins = env.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    await app.register(fastifyCors, {
      origin: origins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    });
  }

  await app.register(mongoosePlugin);
  await app.register(redisPlugin);
  await app.register(rateLimitPlugin);
  await app.register(jwtPlugin);

  // fastify-metrics deve vir ANTES das rotas para hookar onRequest/onResponse
  // por rota. Expõe GET /metrics no formato Prometheus (default endpoint).
  await app.register(metricsPlugin, {
    endpoint: "/metrics",
    routeMetrics: { enabled: true },
    // Limpa registry global do prom-client antes de registrar — necessário
    // para testes E2E que constroem múltiplas instâncias de app no mesmo
    // processo (singleFork). Em produção o registry está vazio no boot,
    // então clear é no-op.
    clearRegisterOnInit: true,
  });

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes, { prefix: "/users" });

  return app;
}
