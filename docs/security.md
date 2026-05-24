# Security — controle-de-acesso

## Modelo de ameaça (resumido)

| Ameaça                        | Mitigação                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brute force em login          | Rate limiting por IP via @fastify/rate-limit                                                                                                         |
| Roubo de senha em trânsito    | HTTPS obrigatório (Vercel garante)                                                                                                                   |
| Vazamento de hash no response | `select: false` no Mongoose + transform no toJSON                                                                                                    |
| Token JWT roubado             | Expiração curta (15min) + blocklist Redis por jti                                                                                                    |
| Enumeração de usuários        | Mensagem genérica em login (não diferenciar email/senha)                                                                                             |
| Injeção de dados              | Validação obrigatória via JSON Schema Fastify + Zod                                                                                                  |
| Headers HTTP inseguros        | @fastify/helmet — registrado em `src/app.ts` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy etc.)                              |
| CORS aberto                   | @fastify/cors — registrado quando `CORS_ORIGIN` está definido; aceita lista CSV de origens explícitas; em produção é obrigatório (sem `origin: '*'`) |

## Hashing de senha: PBKDF2

```typescript
// src/shared/crypto.ts

import { randomBytes, pbkdf2Sync } from "node:crypto";
import { env } from "@/config/env";

export function hashPassword(plain: string): string {
  const salt = randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(
    plain,
    salt,
    env.HASH_ITERATIONS, // 100_000
    env.HASH_KEYLEN, // 64
    env.HASH_DIGEST, // 'sha512'
  ).toString("hex");
  return `${hash}:${salt}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [hash, salt] = stored.split(":");
  const attempt = pbkdf2Sync(
    plain,
    salt,
    env.HASH_ITERATIONS,
    env.HASH_KEYLEN,
    env.HASH_DIGEST,
  ).toString("hex");
  // timingSafeEqual para evitar timing attack
  return timingSafeEqual(Buffer.from(attempt), Buffer.from(hash));
}
```

**Por que não bcrypt?** Ver ADR-001 em `docs/architecture.md`.

## Defesa de timing contra enumeração

`loginUser` em `src/modules/auth/auth.service.ts` **sempre** executa
`verifyPassword`, mesmo quando o e-mail não é encontrado, usando um hash
PBKDF2 pré-computado (`DUMMY_PASSWORD_HASH`) como fallback.

Sem essa defesa, o caminho "email não existe" retorna em ~0ms enquanto o
caminho "senha errada" gasta ~100ms (custo do PBKDF2). Um atacante pode
enumerar e-mails válidos só medindo o tempo de resposta — mesmo com a
mensagem genérica `INVALID_CREDENTIALS`.

O `DUMMY_PASSWORD_HASH` é computado uma única vez no carregamento do
módulo (`hashPassword('timing-defense-placeholder-...')`). Custo: ~100ms
no boot do servidor. Em Vercel Serverless, paga-se por cold start —
aceitável.

## JWT

- Algoritmo: `HS256` (simétrico, suficiente para serviço único)
- Payload obrigatório: `{ sub: userId, email, jti: uuid, iat, exp }`
- TTL: 15 minutos (access token)
- Secret: mínimo 256 bits — gerado com `openssl rand -hex 32`
- Verificação: `@fastify/jwt` com hook `onRequest` nas rotas protegidas

## Blocklist de tokens (logout)

```typescript
// Ao fazer logout:
const { jti, exp } = request.user;
const ttl = exp - Math.floor(Date.now() / 1000);
if (ttl > 0) {
  await redis.set(`blocklist:${jti}`, "1", { EX: ttl });
}

// No middleware de autenticação:
const blocked = await redis.get(`blocklist:${jti}`);
if (blocked) throw new AppError("TOKEN_REVOKED", 401);
```

## Rate limiting

```typescript
// Aplicar em /auth/login e /auth/register
{
  max: 10,           // 10 tentativas
  timeWindow: '1m',  // por minuto
  keyGenerator: (req) => req.ip,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Limite de tentativas excedido. Aguarde 1 minuto.'
  })
}
```

## Checklist de PR — segurança

Antes de aprovar qualquer PR nesta API, verificar:

- [ ] Nenhuma senha ou token em logs
- [ ] Nenhuma variável de ambiente hardcoded
- [ ] Inputs validados antes de qualquer operação de banco
- [ ] Mensagem de erro de auth não vaza informação (email existe / não existe)
- [ ] `passwordHash` não aparece em nenhum response
- [ ] Novos endpoints protegidos têm o hook de auth aplicado
- [ ] Rate limit aplicado em endpoints de auth
- [ ] `jti` presente em todos os JWTs emitidos
