# Rule: Environment Variables

## Regra central

`process.env` é acessado **APENAS** em `src/config/env.ts`. Todo o resto da aplicação
importa de lá. Nenhum módulo, service, plugin ou controller lê `process.env` diretamente.

## Por quê

- Validação centralizada no startup: app não sobe com env incompleta
- Tipos garantidos (Zod infer): sem `string | undefined` espalhado
- Fácil de mockar em testes: override em um único lugar

## src/config/env.ts

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace']).default('info'),

  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),

  HASH_ITERATIONS: z.coerce.number().default(100_000),
  HASH_KEYLEN: z.coerce.number().default(64),
  HASH_DIGEST: z.string().default('sha512'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
```

## Proibido

```typescript
// ERRADO — nunca fazer isso
const secret = process.env.JWT_SECRET

// CORRETO
import { env } from '@/config/env'
const secret = env.JWT_SECRET
```

## Arquivos de ambiente

| Arquivo | Propósito | Commitar? |
|---|---|---|
| `.env.example` | Template com todas as vars (sem valores reais) | ✅ Sim |
| `.env` | Desenvolvimento local | ❌ Não |
| `.env.test` | Testes (MongoDB in-memory, Redis mock) | ❌ Não |
| `.env.local` | Override pessoal (Vercel pull) | ❌ Não |
