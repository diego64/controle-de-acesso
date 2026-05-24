# Rule: Schema (Zod + JSON Schema Fastify)

## Duas camadas de validação

1. **JSON Schema (Fastify)** — validação na borda HTTP, antes de chegar ao controller
2. **Zod** — validação de variáveis de ambiente e tipos internos de domínio

## Obrigatório

- Toda rota com body/params/query DEVE ter `schema` declarado no Fastify
- JSON Schema deve incluir `additionalProperties: false` — rejeitar campos extras
- Campos sensíveis NUNCA aparecem no `response` schema (ex: `passwordHash`)
- Usar `z.toJSONSchema()` (nativo do Zod 4) para reutilizar o schema Zod como fonte de verdade do JSON Schema entregue ao Fastify

## Proibido

- Validar manualmente no controller o que o JSON Schema já pode validar
- `additionalProperties: true` em schemas de request — abre vetor de injeção
- Expor campos internos no schema de response

## Padrão de schema

```typescript
// src/modules/auth/auth.schema.ts

import { z } from 'zod'

export const registerBodySchema = z
  .object({
    email: z.email().max(255),
    password: z.string().min(8).max(128),
  })
  .strict()

export const registerResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime(),
})

// Para uso no Fastify (z.toJSONSchema é nativo do Zod 4).
// SEMPRE passar { target: 'draft-7' } — o Ajv embutido do Fastify 5 não
// reconhece o draft 2020-12 (default do Zod 4) e quebra no boot.
export const registerFastifySchema = {
  body: z.toJSONSchema(registerBodySchema, { target: 'draft-7' }),
  response: {
    201: z.toJSONSchema(registerResponseSchema, { target: 'draft-7' }),
  },
}
```

## Campos sensíveis — lista de controle

Nunca incluir em schemas de response ou em logs:
- `passwordHash`
- `password`
- `JWT_SECRET`
- Tokens completos (logar apenas os primeiros 8 chars se necessário para debug)

## Tipos inferidos

```typescript
// Inferir tipos do Zod para evitar duplicação
export type RegisterBody = z.infer<typeof registerBodySchema>
export type RegisterResponse = z.infer<typeof registerResponseSchema>
```
