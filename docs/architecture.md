# Architecture — controle-de-acesso

## Visão Geral

API REST stateless de autenticação. Sem estado entre requests além do Redis (blocklist JWT).

```
Cliente
  │
  ▼
Fastify (HTTP)
  │
  ├─ POST /auth/register  → AuthController → AuthService → UserRepository → MongoDB
  ├─ POST /auth/login     → AuthController → AuthService → UserRepository + Redis
  ├─ GET  /auth/me        → [JWT Hook] → AuthController → UserRepository
  ├─ GET  /health/live    → HealthController
  └─ GET  /health/ready   → HealthController → MongoDB ping + Redis ping
```

## ADRs

### ADR-001: PBKDF2 via node:crypto em vez de bcrypt
**Status:** Aceito
**Motivo:** bcrypt depende de addon nativo C++ que não compila no ambiente Vercel Serverless.
**Decisão:** PBKDF2 com 100.000 iterações, SHA-512, salt de 32 bytes por usuário.
**Consequência:** Hash ~2x mais rápido, sem dependência nativa. Custo: menos adotado como padrão de mercado, mas equivalente em segurança para este caso.

### ADR-002: Redis para blocklist de JWT (não blacklist de sessão)
**Status:** Aceito
**Motivo:** JWT stateless não tem invalidação nativa. Logout explícito requer registro externo.
**Decisão:** Armazenar `jti` do token revogado com TTL igual ao tempo restante de expiração.
**Consequência:** Redis vira dependência crítica para logout. Fallback: token expira naturalmente se Redis estiver fora.

### ADR-003: Fastify em vez de Express
**Status:** Aceito
**Motivo:** JSON Schema nativo, serialização 2x mais rápida, plugin system com escopo isolado, `inject()` para testes E2E sem servidor real.
**Consequência:** Curva de aprendizado ligeiramente maior para devs Express-only.

### ADR-004: Deploy Vercel Serverless
**Status:** Aceito
**Motivo:** Zero infra para gerenciar, CI/CD automático, integração com MongoDB Atlas e Upstash Redis.
**Restrições:** Sem WebSocket, sem processos longos (timeout 10s no plano hobby), sem addons nativos (daí ADR-001).

### ADR-005: Upgrade da stack para majors mais recentes (Fastify 5, Mongoose 9, Zod 4, ESLint 10)
**Status:** Aceito — 2026-05-22
**Motivo:** A stack original (Fastify 4, Mongoose 8, Zod 3, ESLint 8) ainda funciona, porém ESLint 8 está marcado como deprecated pelo próprio time do projeto e os demais majors trazem ganhos relevantes (Fastify 5 melhora tipagem, Mongoose 9 alinha com Node 20+, Zod 4 reduz superfície de API). Sem o upgrade, acumulamos dívida cedo no ciclo de vida do projeto.
**Decisão:** Subir para:
- `fastify ^5.x`
- `@fastify/jwt ^10.x` (compatível com Fastify 5)
- `fastify-plugin ^5.x`
- `mongoose ^9.x`
- `zod ^4.x`
- `eslint ^10.x` (flat config obrigatória; remove flag `--ext`)
- `@typescript-eslint/*` `^8.x` (latest disponível; peer-warning aceito enquanto v9/v10 não estabilizam)

**Consequências e ações obrigatórias:**
- Migrar config ESLint de `.eslintrc.json` para `eslint.config.js` (flat config).
- Remover flag `--ext` dos scripts `lint` / `lint:fix` (ESLint 9 não aceita).
- Substituir `z.string().url()` por `z.url()` em `src/config/env.ts` (API Zod 4).
- Confirmar que `fastify-plugin@5` mantém assinatura usada nos plugins atuais (logger, mongoose, redis, jwt, errorHandler).
- Node 20 LTS continua sendo a base — ambas as majors exigem Node 20+, alinhado ao CLAUDE.md.

**Riscos:**
- Zod 4 mudou o shape de alguns retornos de `safeParse` em casos avançados. Mantemos `flatten().fieldErrors` que continua existindo.
- Fastify 5 endureceu defaults de validação (schemas inválidos passam a falhar onde antes apenas avisavam). Não nos afeta porque ainda não há rotas com schema.
- ESLint 9 flat config tem semântica diferente para `overrides` (vira segundo objeto exportado). Ajuste necessário no arquivo de config.

**Reversibilidade:** Alta enquanto não houver módulos de negócio implementados. Custo cresce conforme rotas/repositories são adicionados — daí o upgrade ser feito agora, antes do módulo `auth`.

### ADR-006: Container Docker da aplicação (paralelo ao Vercel)
**Status:** Aceito — 2026-05-22
**Motivo:** Vercel Serverless (ADR-004) continua sendo o **deploy de produção oficial**, mas hoje só é possível rodar a app localmente fora de container — quem clona o repo precisa de Node 20 + pnpm + Mongo/Redis acessíveis. Um Dockerfile resolve dois problemas:
1. **Paridade dev/prod local** — comportamento idêntico em qualquer máquina, sem "funciona no meu Node".
2. **Plano B de deploy** — se Vercel for inviável (limite de timeout, política corporativa, etc.), o mesmo container roda em ECS/Cloud Run/Fly.io sem nenhuma mudança de código.

**Decisão:**
- Adicionar `infra/Dockerfile` multi-stage (builder + runner Alpine, user não-root, healthcheck via `/health/live`). Context do build é a raiz do projeto.
- Adicionar service `app` ao `infra/docker-compose.yml` consumindo o Dockerfile e dependendo dos serviços de infra existentes (mongodb, redis).
- Adicionar `tsc-alias` como devDep para reescrever os path aliases `@/*` no `dist/` (sem isso, `node dist/server.js` quebra em runtime).
- Manter Vercel como deploy primário em produção. O container é canônico para dev e contingência.

**Consequências e ações obrigatórias:**
- `pnpm build` agora roda `tsc + tsc-alias` em sequência — o output de `dist/` fica self-contained.
- `infra/.env` ganha os campos consumidos pela app (JWT_SECRET, JWT_EXPIRES_IN, HASH_*); antes só tinha credenciais de infra.
- Container expõe porta 3000 no host; conflita com `pnpm dev` rodando em paralelo (apenas um pode bindar a porta por vez).

**Riscos:**
- Container introduz nova superfície (imagem, base Alpine) — vulnerabilidades nessa imagem se tornam concern. Mitigação: usar `node:20-alpine` oficial mantido pela Node.js Foundation; atualizar via Dependabot quando configurado.
- `tsc-alias` é dep adicional (uma única, devDep). Risco baixo; mantido pelo autor original (estável há anos).

**Reversibilidade:** Trivial — deletar `Dockerfile`, `.dockerignore`, service `app` do compose, e o ADR. Sem mudança no código fonte.

## SLOs

| Métrica | Objetivo |
|---|---|
| Disponibilidade | 99.5% mensal |
| Latência p95 login | < 300ms |
| Latência p95 register | < 500ms |
| Taxa de erro 5xx | < 0.5% |

## Fluxo crítico: Login

```
1. Receber { email, password }
2. Validar schema (Fastify JSON Schema)
3. Buscar usuário por email no MongoDB
4. Se não encontrar → retornar 401 (mensagem genérica)
5. Verificar hash PBKDF2 da senha
6. Se inválido → retornar 401 (mesma mensagem genérica)
7. Gerar JWT com { sub: userId, jti: uuid, exp: now+15m }
8. Retornar { accessToken, expiresIn }
```

## Fluxo crítico: Rota Protegida

```
1. Extrair Bearer token do header Authorization
2. Verificar assinatura JWT (@fastify/jwt)
3. Verificar se jti está na blocklist Redis
4. Se bloqueado → retornar 401
5. Injetar { user: { id, email } } no request
6. Passar para o handler
```
