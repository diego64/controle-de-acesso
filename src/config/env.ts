import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  MONGODB_URI: z.url(),
  REDIS_URL: z.url(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),

  HASH_ITERATIONS: z.coerce.number().int().positive().default(100_000),
  HASH_KEYLEN: z.coerce.number().int().positive().default(64),
  HASH_DIGEST: z.string().default('sha512'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  /* eslint-disable-next-line no-console -- pré-logger: falha de boot precisa ser visível */
  console.error(
    'Variáveis de ambiente inválidas:',
    parsed.error.flatten().fieldErrors,
  )
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
