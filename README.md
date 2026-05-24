# controle-de-acesso

API de **autenticação e controle de acesso** com JWT, roles (`ADMINISTRADOR` / `USUARIO`), blocklist Redis para logout e observabilidade completa.

---

## Sumário

1. [O que faz](#o-que-faz)
2. [Stack](#stack)
3. [Setup rápido (Docker)](#setup-rápido-docker)
4. [Setup local (dev sem container da app)](#setup-local-dev-sem-container-da-app)
5. [Endpoints](#endpoints)
6. [Comandos](#comandos)
7. [Estrutura](#estrutura)
8. [Observabilidade](#observabilidade)
9. [Testes](#testes)
10. [Decisões de arquitetura (ADRs)](#decisões-de-arquitetura-adrs)
11. [Segurança](#segurança)
12. [Troubleshooting](#troubleshooting)

---

## O que faz

| Operação                                          | Rota                  | Auth    | Role              |
| ------------------------------------------------- | --------------------- | ------- | ----------------- |
| Registrar usuário (nome, sobrenome, email, senha) | `POST /auth/register` | público | —                 |
| Login (JWT 15min)                                 | `POST /auth/login`    | público | —                 |
| Dados do user logado                              | `GET /auth/me`        | Bearer  | qualquer          |
| Logout (revoga jti no Redis)                      | `POST /auth/logout`   | Bearer  | qualquer          |
| Listar todos os usuários                          | `GET /users/`         | Bearer  | **ADMINISTRADOR** |
| Liveness probe                                    | `GET /health/live`    | público | —                 |
| Readiness probe (Mongo + Redis)                   | `GET /health/ready`   | público | —                 |
| Métricas Prometheus                               | `GET /metrics`        | público | —                 |

**Escopo fechado:** nada além disso. Sem refresh tokens, sem CRUD de usuários, sem federação. Documentado em [CLAUDE.md](./CLAUDE.md).

---

## Stack

| Camada      | Tech                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| Runtime     | Node.js 20 LTS                                                                 |
| Linguagem   | TypeScript 5 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| HTTP        | Fastify 5                                                                      |
| ODM         | Mongoose 9                                                                     |
| Validação   | Zod 4 (+ JSON Schema nativo Fastify)                                           |
| Auth        | `@fastify/jwt` 10 + `node:crypto` PBKDF2                                       |
| DB          | MongoDB 7 (Atlas em produção)                                                  |
| Cache       | Redis 7 (Upstash em produção)                                                  |
| Lint        | ESLint 10 (flat config)                                                        |
| Testes      | Vitest 1.6 + `mongodb-memory-server` + `ioredis-mock`                          |
| Observab.   | Prometheus + Grafana + `fastify-metrics` + `mongodb_exporter`                  |
| Deploy      | Vercel Serverless (primário) / Docker (paridade dev + contingência)            |
| Package mgr | pnpm 9                                                                         |

Versões pinadas e justificadas em [ADR-005 / ADR-006](./docs/architecture.md#adrs).

---

## Setup rápido (Docker)

A forma mais rápida — sobe a app + Mongo + Redis + Prometheus + Grafana + mongodb-exporter em containers.

### 1. Pré-requisitos

- Docker 24+ (Compose v2)
- 2 GB livres de RAM para os containers
- Portas livres: **3000** (app), **3001** (Grafana), **9090** (Prometheus), **9216** (mongodb-exporter), **27017** (Mongo), **6379** (Redis)

### 2. Configurar segredos

```bash
cp infra/.env.example infra/.env
# Edite infra/.env preenchendo TODAS as vars. Para gerar senhas:
#   openssl rand -hex 24    (Mongo/Redis/Grafana)
#   openssl rand -hex 32    (JWT_SECRET — mínimo 32 chars)
```

### 3. Subir a stack

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

### 4. Aguardar healthy

```bash
docker compose -f infra/docker-compose.yml ps
# Espera ca-app aparecer "Up X seconds (healthy)" — ~15s após start
```

### 5. Popular o banco com usuários de teste

```bash
cp .env.example .env
# Edite .env com as MESMAS credenciais de infra/.env (MONGODB_URI, REDIS_URL, JWT_SECRET).
pnpm install
pnpm seed
```

Saída esperada:

```
✓ Mongo conectado (db=controle-de-acesso)
  [created] ADMINISTRADOR admin@local.dev    (id=…)
  [created] USUARIO       usuario@local.dev  (id=…)

✓ Seed concluído
═══ Credenciais de DEV (NÃO usar em produção) ═══
  ADMINISTRADOR → admin@local.dev   / admin-local-dev-2026
  USUARIO       → usuario@local.dev / usuario-local-dev-2026
```

### 6. Smoke test

```bash
# Login → token → me
TOKEN=$(curl -sS -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.dev","password":"admin-local-dev-2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -sS http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
curl -sS http://localhost:3000/users/ -H "Authorization: Bearer $TOKEN"
```

### 7. Postman (opcional)

Importe [`controle-de-acesso.postman_collection.json`](./controle-de-acesso.postman_collection.json) → 8 requests com test scripts encadeando automaticamente o `accessToken`.

---

## Setup local (dev sem container da app)

Útil para hot-reload de código TypeScript com `tsx watch`.

```bash
# 1. Infra apenas (mongo/redis/prometheus/grafana)
docker compose -f infra/docker-compose.yml up -d mongodb redis prometheus grafana mongodb-exporter

# 2. App local com hot-reload
cp .env.example .env  # editar credenciais conforme infra/.env
pnpm install
pnpm dev              # tsx watch src/server.ts

# 3. Em outro terminal:
pnpm seed             # cria os 2 usuários de teste
```

**Diferença:** com `pnpm dev` a app roda fora do container — toda mudança em `src/**` reinicia automaticamente. Em container, é preciso rebuild (`docker compose up -d --build app`).

---

## Endpoints

### `POST /auth/register`

```json
// Request
{
  "email": "joao@example.com",
  "password": "senha-com-no-minimo-8-chars",
  "firstName": "João",
  "lastName": "Silva"
}

// 201 Created
{
  "id": "6a10...",
  "email": "joao@example.com",
  "firstName": "João",
  "lastName": "Silva",
  "role": "USUARIO",
  "createdAt": "2026-05-24T18:00:00.000Z"
}
```

**Erros:** `409 EMAIL_ALREADY_EXISTS`, `422 VALIDATION_ERROR`. Rate-limit: 5/min por IP.

### `POST /auth/login`

```json
// Request
{ "email": "...", "password": "..." }

// 200 OK
{
  "accessToken": "eyJhbGc...",
  "expiresIn": "15m"
}
```

**Erros:** `401 INVALID_CREDENTIALS` (mesma mensagem para "email não existe" e "senha errada" — anti-enumeração). Rate-limit: 10/min por IP.

### `GET /auth/me` (Bearer)

Retorna `{ id, email, firstName, lastName, role, createdAt }` do usuário logado. **Erros:** `401 TOKEN_MISSING | TOKEN_INVALID | TOKEN_REVOKED`, `403 TOKEN_EXPIRED`.

### `POST /auth/logout` (Bearer)

Revoga o token corrente (`jti` na blocklist Redis com TTL = `exp - now`). Resposta `204 No Content`. Próximo request com mesmo token → `401 TOKEN_REVOKED`.

### `GET /users/` (Bearer + role `ADMINISTRADOR`)

Lista todos os usuários, ordenados por `createdAt desc`. Cada item igual ao `/auth/me`. **Erros:** `401 TOKEN_MISSING`, `403 FORBIDDEN`.

### Health

- `GET /health/live` → `200 { status: "ok", timestamp }` — sempre que o processo responder.
- `GET /health/ready` → `200` se Mongo+Redis pingam, `503` caso contrário. Body com detalhe por serviço.

### Métricas

- `GET /metrics` → formato Prometheus. Métricas Node (process, GC, event loop) + HTTP por rota (duration histogram, count por status code).

---

## Comandos

```bash
# Dev
pnpm dev                 # tsx watch src/server.ts (hot-reload)
pnpm build               # tsc + tsc-alias (gera dist/ standalone)
pnpm start               # node dist/server.js (rodar build)
pnpm seed                # popula DB com ADMIN + USUARIO de dev

# Qualidade
pnpm type-check          # tsc --noEmit
pnpm lint                # eslint src tests scripts
pnpm lint:fix
pnpm format              # prettier

# Testes
pnpm test                # vitest run (unit + e2e)
pnpm test:unit           # só unit (vitest --project unit)
pnpm test:e2e            # só e2e (vitest --project e2e)
pnpm test:coverage       # com cobertura via v8
pnpm test:load           # k6 (tests/load/login.k6.js — esqueleto)

# Infra
docker compose -f infra/docker-compose.yml up -d              # subir tudo
docker compose -f infra/docker-compose.yml up -d --build app  # rebuild só da app
docker compose -f infra/docker-compose.yml down               # parar (preserva volumes)
docker compose -f infra/docker-compose.yml down -v            # ZERA dados (mongo+redis+grafana)
docker compose -f infra/docker-compose.yml logs -f app        # logs da app
```

---

## Estrutura

```
src/
├── config/                  # env.ts — ÚNICO ponto autorizado a ler process.env
├── models/                  # Mongoose Schemas (User, ...)
├── modules/<nome>/          # Domínio por contexto:
│   ├── <nome>.controller.ts #   rotas Fastify (composition root do módulo)
│   ├── <nome>.service.ts    #   lógica de negócio (DI explícita, sem Fastify)
│   ├── <nome>.schema.ts     #   Zod + JSON Schema da rota
│   ├── <nome>.types.ts      #   DTOs e tipos do domínio
│   ├── <nome>.repository.ts #   acesso a DB (interface + impl Mongo)
│   └── <outros>.ts          #   abstrações específicas (ex.: blocklist.ts em auth/)
├── middlewares/             # Factories que retornam preHandlers (DI explícita)
├── plugins/                 # Encapsulamento Fastify (mongoose, redis, jwt, rateLimit...)
├── shared/                  # Primitivos transversais (crypto.ts, errors/AppError.ts)
├── types/                   # Augmentações de tipo (fastify.d.ts)
├── app.ts                   # buildApp(): registra plugins na ordem correta
└── server.ts                # entrypoint (listen + traps SIGTERM/SIGINT)

scripts/                     # CLI tools (seed, _load-env)
tests/{unit,e2e,load,types}/ # Vitest workspace
infra/                       # Dockerfile, docker-compose, prometheus, grafana provisioning
docs/                        # ADRs, security, database, events, runbooks
.claude/                     # rules + skills para Claude Code
```

**Plugins vs Middlewares:**

- _Plugin_ (`src/plugins/`) decora a instância Fastify (`app.redis`, `app.jwt`, `app.authenticate`).
- _Middleware_ (`src/middlewares/`) é uma factory `createX(deps): preHandler` — testável sem subir Fastify.
- O plugin instancia o middleware com deps reais e o decora em `app`.

**Composition root:** instanciação concreta de `repository`, `blocklist`, `signer` etc. acontece no `controller.ts` do módulo. Services e middlewares só recebem **interfaces**.

---

## Observabilidade

Tudo provisionado via Docker — sem clique manual.

### Grafana

Acessível em **http://localhost:3001** (admin / `GRAFANA_ADMIN_PASSWORD` em `infra/.env`).

Estrutura:

```
📁 Local                                  📁 Cloud
   ├─ Ambiente Geral                         ├─ Ambiente Geral
   ├─ Banco de Dados                         ├─ Banco de Dados
   └─ SLOs                                   └─ SLOs
```

- **Ambiente Geral** — status de targets, scrape duration, memória, CPU.
- **Banco de Dados** — MongoDB up/conexões/ops/memória (via `mongodb_exporter`).
- **SLOs** — disponibilidade %, p95 por rota, error rate 5xx, top rotas lentas. Thresholds visuais nos SLOs declarados.

Folder **Cloud** vem com placeholder até `GRAFANA_CLOUD_PROMETHEUS_URL` ser configurado.

### Prometheus

**http://localhost:9090** — query/exploration.

3 targets ativos:

- `prometheus` (self-scrape)
- `controle-de-acesso` (app — via `fastify-metrics`)
- `mongodb` (via `mongodb_exporter`)

### Alerting

4 rules configuradas em `infra/grafana/provisioning/alerting/rules.yaml`:

| Alerta                       | Severity | Threshold                       | `for` |
| ---------------------------- | -------- | ------------------------------- | ----- |
| Disponibilidade < 99.5% (1h) | critical | `avg(up[1h])*100 < 99.5`        | 5m    |
| p95 /auth/login > 300ms      | warning  | `histogram_quantile(0.95, ...)` | 5m    |
| p95 /auth/register > 500ms   | warning  | idem                            | 5m    |
| Taxa erro 5xx > 0.5%         | critical | `5xx_rate / total > 0.5%`       | 5m    |

Cada alerta tem **runbook** dedicado em [`docs/runbooks/`](./docs/runbooks/) com diagnose, causas e mitigação.

Webhook receiver configurável via `ALERT_WEBHOOK_URL` em `infra/.env`. Para Slack/Discord, basta colar o incoming webhook URL.

---

## Testes

Cobertura atual: **48 testes** (21 unit + 27 E2E) rodando em ~3s.

### Unit

- `tests/unit/crypto.test.ts` — `hashPassword` (formato hex, salt aleatório), `verifyPassword` (correto/errado/malformed, timing-safe).
- `tests/unit/auth.service.test.ts` — `registerUser` (DTO sem passwordHash, hash antes do create, 409 dup), `loginUser` (JWT jti UUID, anti-enumeração), `logoutUser` (TTL = exp - now).

Setup: `tests/unit/setup.ts` define env vars e baixa `HASH_ITERATIONS=1` (sem afetar corretude, ganha ~100x velocidade).

### E2E

- `tests/e2e/auth.test.ts` — 4 rotas de auth (register/login/me/logout) incluindo round-trip do logout (200 → 204 → 401 TOKEN_REVOKED).
- `tests/e2e/users.test.ts` — `/users` em 4 cenários (401/403/200/TOKEN_REVOKED quando admin deletado).
- `tests/e2e/health.test.ts` — `/live` + `/ready` (200 + 503 forçado via `vi.spyOn`).

Infra de teste:

- **MongoDB:** `mongodb-memory-server` (binário cached em `~/.cache/`).
- **Redis:** `ioredis-mock` via `vi.mock('ioredis')` em cada arquivo.
- **Vitest workspace** com 2 projects (`unit`, `e2e`); `e2e` usa `pool: 'forks'` + `singleFork: true` pra isolamento.
- **Global setup** sobe Mongo in-memory uma vez por suite.

---

## Decisões de arquitetura (ADRs)

Resumo (detalhes em [`docs/architecture.md`](./docs/architecture.md)):

| #   | Decisão                                              | Motivação                                                     |
| --- | ---------------------------------------------------- | ------------------------------------------------------------- |
| 1   | PBKDF2 via `node:crypto` (sem bcrypt)                | bcrypt usa addon C++ que não compila no Vercel Serverless     |
| 2   | Redis para blocklist de JWT (não sessão)             | JWT stateless não invalida; logout precisa registro externo   |
| 3   | Fastify em vez de Express                            | JSON Schema nativo + `inject()` para testes E2E               |
| 4   | Vercel Serverless                                    | Zero infra, CI/CD automático                                  |
| 5   | Upgrade para Fastify 5, Mongoose 9, Zod 4, ESLint 10 | Atualizar majors enquanto blast radius é baixo (pré-features) |
| 6   | Container Docker como paralelo ao Vercel             | Paridade dev/prod local + plano B de deploy                   |

---

## Segurança

Mitigação documentada em [`docs/security.md`](./docs/security.md):

| Ameaça                    | Mitigação                                                                       |
| ------------------------- | ------------------------------------------------------------------------------- |
| Brute force em login      | Rate limit 10/min/IP via `@fastify/rate-limit`                                  |
| Roubo de hash em response | `select: false` no Mongoose + `toJSON.transform`                                |
| Token JWT roubado         | TTL 15min + blocklist Redis por `jti`                                           |
| Enumeração de usuários    | Mensagem `INVALID_CREDENTIALS` genérica + `DUMMY_PASSWORD_HASH` para timing     |
| Injeção via campos extras | `additionalProperties: false` (Zod `.strict()` + Ajv `removeAdditional: false`) |
| Promoção indevida a admin | **Sem endpoint** — só via mongosh manual com credenciais root                   |

**Pendências de produção** (auditadas em code-review, rastreadas):

- `trustProxy: true` precisa whitelist explícita antes de prod.
- `CastError` em `findById` com `sub` inválido → 500 (deveria 401) — runbook em `docs/runbooks/slo-error-rate-high.md`.

---

## Troubleshooting

| Sintoma                                                                  | Solução                                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm seed` retorna `Unauthorized` ao Mongo                              | Senha em `.env` raiz não bate com `infra/.env`. Sincronize.                                                                                |
| `docker compose up` falha com `MONGO_INITDB_ROOT_USERNAME é obrigatório` | `infra/.env` não existe ou está vazio. Copie de `.env.example`.                                                                            |
| App container `unhealthy`                                                | Healthcheck do Dockerfile usa `127.0.0.1` (não `localhost`, que resolve para `::1` no Alpine). Veja `infra/Dockerfile`.                    |
| `/users` retorna 403 para o user seedado como admin                      | Verifique no Mongo: `db.users.find({email:"..."}, {role:1})`. Promova com `db.users.updateOne(...)` — veja `CLAUDE.local.md` (gitignored). |
| Testes E2E falham com "metric already registered"                        | `clearRegisterOnInit: true` no `metricsPlugin` resolve. Verifique `src/app.ts`.                                                            |
| Husky bloqueia commit com "command not found"                            | Rode `pnpm install` na raiz — instala hooks via `prepare`.                                                                                 |
| `pnpm install` demora >5min na primeira vez                              | `mongodb-memory-server` baixa binário do Mongo (~70 MB). Subsequent installs reutilizam cache.                                             |

Mais cenários e diagnose: [`docs/runbooks/`](./docs/runbooks/).

---

## Licença

[ISC](./LICENSE)
