// Entrypoint Vercel Serverless. Cada arquivo em /api vira uma function;
// como nossa API tem várias rotas servidas pelo mesmo Fastify app, fazemos
// catch-all via vercel.json#rewrites apontando todas as URLs pra cá.
//
// Padrão recomendado pela Fastify (https://fastify.dev/docs/latest/Guides/Serverless/):
// cachear o app entre invocações pra amortizar o custo de boot.
import type { IncomingMessage, ServerResponse } from 'node:http'
// Importa do dist/ (não src/) — tsc-alias já reescreveu os `@/...` aliases
// em paths relativos. @vercel/node não aplica tsconfig#paths quando compila
// nossas sources direto, então usar dist/ é mandatório aqui.
import { buildApp } from '../dist/app.js'

// Promise cacheada — primeira invocação paga o cold start (mongoose connect,
// redis ping, prom-client register, DUMMY_PASSWORD_HASH ~100ms). Subsequentes
// reusam a mesma instância.
const appPromise = buildApp().then(async (app) => {
  await app.ready()
  return app
})

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await appPromise
  app.server.emit('request', req, res)
}
