# CLAUDE.md — controle-de-acesso

---

## Modo operacional — executar antes de qualquer ação

```
1. Ler este arquivo inteiro
2. Carregar as rules obrigatórias da seção abaixo
3. Consultar os docs relevantes para a tarefa
4. Planejar a alteração (objetivo + arquivos impactados)
5. Só então gerar código
```

Nunca pular etapas. Nunca assumir o que não está documentado aqui.

---

## O que é esta API

Serviço de autenticação e controle de acesso. Escopo fixo:

- Registro de usuário (email, senha, nome, sobrenome)
- Login com emissão de JWT
- Rota protegida por token
- Roles `ADMINISTRADOR` e `USUARIO` (default `USUARIO`)
- Rota admin-only para listar usuários (`GET /users`)
- Conexão com MongoDB via Mongoose
- Integração com Redis (blocklist de tokens)

**Nada além disso.** Sem lógica de negócio de domínio externo neste serviço.

Promoção de usuário a `ADMINISTRADOR` é manual via mongosh — sem endpoint
para evitar superfície de ataque (ver instruções em `CLAUDE.local.md`).

---

## Stack — não alterar sem ADR em docs/architecture.md

| Camada         | Tecnologia                            |
|----------------|---------------------------------------|
| Runtime        | Node.js 20 LTS                        |
| Linguagem      | TypeScript 5.x strict                 |
| HTTP           | Fastify 5.x (ADR-005)                 |
| ODM            | Mongoose 9.x (ADR-005)                |
| DB local       | MongoDB 7 (Docker)                    |
| DB produção    | MongoDB Atlas                         |
| Cache local    | Redis 7 (Docker)                      |
| Cache produção | Upstash Redis                         |
| Auth           | @fastify/jwt 10.x + node:crypto       |
| Validação      | Zod 4.x + JSON Schema nativo Fastify  |
| Lint           | ESLint 10.x (flat config) (ADR-005)   |
| Testes unit    | Vitest                                |
| Testes E2E     | Vitest + fastify.inject()             |
| Testes carga   | k6                                    |
| Observab.      | Prometheus + Grafana                  |
| Deploy         | Vercel Serverless (primário) / Docker (paridade dev + contingência) (ADR-006) |
| Package mgr    | pnpm                                  |

---

## Estrutura de diretórios

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
│   └── <outros>.ts          #   abstrações específicas do domínio (ex.: blocklist.ts em auth/)
├── middlewares/             # Factories que retornam preHandlers Fastify (DI explícita)
├── plugins/                 # Encapsulamento Fastify (mongoose, redis, jwt, rateLimit, errorHandler)
├── shared/                  # Primitivos transversais (crypto.ts, errors/AppError.ts)
├── types/                   # Augmentações de tipo (fastify.d.ts)
├── app.ts                   # buildApp(): registra plugins na ordem correta
└── server.ts                # entrypoint (listen + traps SIGTERM/SIGINT)
```

**Plugins vs Middlewares — distinção obrigatória:**

| Categoria | O que faz | Exemplo |
|---|---|---|
| Plugin (`src/plugins/`) | Encapsula infra e/ou decora a instância Fastify | `app.redis`, `app.jwt`, `app.authenticate` |
| Middleware (`src/middlewares/`) | Factory `createX(deps): preHandler` — testável sem subir Fastify | `createAuthenticate(blocklist)` |

O plugin instancia o middleware com suas dependências reais e o decora em `app` (ex.: `app.decorate('authenticate', createAuthenticate(blocklist))`). Em testes unitários, basta passar mocks à factory.

**Composition root**: a instanciação concreta de `repository`, `blocklist`, `signer` etc. acontece no `controller.ts` do módulo. Services e middlewares só recebem interfaces.

---

## Rules — carregamento obrigatório

Antes de gerar código, revisar código ou modificar qualquer arquivo,
carregar e obedecer obrigatoriamente as rules relevantes para a tarefa:

| Rule | Carregar quando |
|---|---|
| `.claude/rules/service.md` | Criar ou modificar qualquer service |
| `.claude/rules/controller.md` | Criar ou modificar rotas ou handlers |
| `.claude/rules/repository.md` | Criar ou modificar repositories |
| `.claude/rules/schema.md` | Criar ou modificar schemas Zod ou JSON Schema |
| `.claude/rules/error-handling.md` | Qualquer código que lança ou captura erro |
| `.claude/rules/environment.md` | Qualquer acesso a variáveis de ambiente |
| `.claude/rules/typescript.md` | Todo código TypeScript sem exceção |
| `.claude/rules/testing.md` | Criar ou modificar qualquer teste |
| `.claude/rules/git.md` | Qualquer commit ou PR |

**Prioridade em caso de conflito:**
1. Este arquivo (CLAUDE.md)
2. Rules (`.claude/rules/`)
3. Docs (`docs/`)
4. Pedido do usuário

Nunca ignorar uma rule silenciosamente.
Se um pedido violar uma rule, explicar o motivo antes de responder.

---

## Docs — consultar conforme necessidade

| Arquivo | Quando consultar |
|---|---|
| `docs/architecture.md` | Decisões de arquitetura, ADRs, SLOs, fluxos críticos |
| `docs/database.md` | Mongoose schemas, modelagem, índices, conexão |
| `docs/security.md` | JWT, PBKDF2, rate limit, checklist de PR |
| `docs/events.md` | Contratos de eventos futuros (Kafka não implementado) |
| `docs/runbooks/` | Diagnóstico + mitigação de cada alerta SLO firado |

---

## Proibições absolutas — nunca violar

### Dependências
❌ PROIBIDO: `bcrypt`, `bcryptjs`, qualquer addon nativo C++
✅ OBRIGATÓRIO: `node:crypto` + PBKDF2 (quebra no build Vercel)

### Variáveis de ambiente
❌ PROIBIDO: `process.env.QUALQUER_COISA` fora de `src/config/env.ts`
✅ OBRIGATÓRIO: `import { env } from '@/config/env'`

### Erros
❌ PROIBIDO: `throw new Error('qualquer string')`
✅ OBRIGATÓRIO: `throw new AppError('CODIGO', statusCode)`

### Tipagem
❌ PROIBIDO: `any` sem comentário `// justificativa: ...` na linha anterior
✅ OBRIGATÓRIO: tipos explícitos em parâmetros e retornos públicos

### Logs
❌ PROIBIDO: `console.log`, `console.error`, `console.warn`
✅ OBRIGATÓRIO: logger pino estruturado (embutido no Fastify)

### Segurança de autenticação
❌ PROIBIDO: mensagens diferentes para "email não existe" vs "senha errada"
✅ OBRIGATÓRIO: mensagem genérica única em toda falha de login

### JWT
❌ PROIBIDO: emitir JWT sem campo `jti`
✅ OBRIGATÓRIO: `jti: crypto.randomUUID()` em todo token emitido

### Testes
❌ PROIBIDO: `app.inject()` sem `await app.ready()` antes
❌ PROIBIDO: testes E2E sem `beforeEach` limpando collections
✅ OBRIGATÓRIO: padrão AAA em todo teste

### Repositório
❌ PROIBIDO: commitar `.env`, `.env.test`, `.env.local`
✅ OBRIGATÓRIO: apenas `.env.example` no repositório

---

## Restrições de geração

Não inventar nenhum dos itens abaixo sem proposta explícita e aprovação:

- Dependências novas
- Padrões arquiteturais não documentados
- Abstrações não existentes (factories, decorators, etc.)
- Middlewares não descritos em docs/
- Schemas sem contrato definido
- Nomes de eventos (ver docs/events.md)
- Estruturas de diretório diferentes da definida em CLAUDE.md

Se algo não estiver documentado:
→ perguntar antes de implementar
ou
→ propor explicitamente como sugestão marcada com `[PROPOSTA]`

---

## Checklist obrigatório antes de finalizar qualquer resposta

Confirmar cada item antes de entregar código:

- [ ] Sem `any` sem justificativa
- [ ] Sem `process.env` direto
- [ ] Sem `bcrypt` ou addon nativo
- [ ] Sem `throw new Error('string')`
- [ ] Sem `console.log`
- [ ] Controllers sem lógica de negócio
- [ ] Services sem `FastifyRequest` / `FastifyReply`
- [ ] Repository retorna DTO puro (sem Document Mongoose)
- [ ] `AppError` usado para todos os erros de domínio
- [ ] Logger pino usado para todos os logs
- [ ] Tipagem strict válida
- [ ] JWT contém `jti`
- [ ] Testes seguem padrão AAA
- [ ] `await app.ready()` antes de `inject()` nos testes E2E

---

## Formato de resposta obrigatório

Para qualquer geração ou modificação de código, responder sempre com:

```
OBJETIVO: o que será feito
ARQUIVOS ALTERADOS: lista de arquivos criados/modificados
REGRAS APLICADAS: quais rules foram consultadas
IMPACTO: o que muda no comportamento da API
```

Seguido do código.

---

## Comandos

```bash
# Desenvolvimento
pnpm dev                                          # tsx watch src/server.ts
pnpm build                                        # tsc --noEmit + build
pnpm type-check                                   # tsc --noEmit
pnpm lint                                         # eslint src --ext .ts

# Testes
pnpm test                                         # unit + e2e
pnpm test:unit                                    # Vitest --project unit
pnpm test:e2e                                     # Vitest --project e2e
pnpm test:coverage                                # Vitest --coverage
pnpm test:load                                    # k6 run tests/load/login.k6.js

# Infra local
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml down -v
```

---

## Skills disponíveis

| Comando | Quando usar |
|---|---|
| `/task-breakdown` | Antes de implementar qualquer feature nova |
| `/pr-describe` | Antes de abrir qualquer PR |
| `/test-triage` | Quando algum teste falhar |
| `/pr-review` | Antes de aprovar qualquer PR |
| `/changelog` | Na hora de gerar uma release |
| `/code-reviewer` | Review focado em qualidade e padrões |
| `/architect` | Decisões que impactam estrutura ou contratos |
