# Deploy — Vercel + MongoDB Atlas + Upstash Redis

Guia passo-a-passo para subir a API em produção usando o stack documentado em [ADR-004](./architecture.md#adrs):

- **Compute:** Vercel Serverless Functions
- **DB:** MongoDB Atlas (M0 free tier)
- **Cache/Blocklist:** Upstash Redis (free tier)

Tempo total estimado: **20–30 min** (somente cliques de UI, sem código).

---

## 0. Pré-requisitos

- Conta GitHub com o repo importado (já feito).
- Conta Vercel ([vercel.com/signup](https://vercel.com/signup) — gratuito).
- Conta MongoDB Atlas ([cloud.mongodb.com/register](https://www.mongodb.com/cloud/atlas/register) — gratuito).
- Conta Upstash ([console.upstash.com](https://console.upstash.com/signup) — gratuito).
- `openssl` instalado (gerar `JWT_SECRET`).

---

## 1. MongoDB Atlas

### 1.1 Criar cluster M0 (free)

1. Login em [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Build a Database → M0 (Free Sandbox)**.
3. Provider: **AWS**; Region: **South America (sa-east-1)** ou outra próxima do Vercel `gru1`.
4. Cluster Name: `controle-de-acesso-prod`.
5. **Create**.

### 1.2 Criar usuário de aplicação

1. Sidebar **Database Access → Add New Database User**.
2. Auth Method: **Password**.
3. Username: `ca_app`.
4. Password: clique **Autogenerate Secure Password** (24+ chars) → **copie**.
5. Privileges: **Read and write to any database** _(simpler)_ OU **Specific Privileges → readWrite@controle-de-acesso** _(mais seguro)_.
6. **Add User**.

### 1.3 Liberar IPs

> ⚠ Vercel Serverless usa IPs dinâmicos. Duas opções:

**Opção A (recomendada para começar):** liberar tudo

1. Sidebar **Network Access → Add IP Address → ALLOW ACCESS FROM ANYWHERE** (0.0.0.0/0).
2. **Confirm**.

**Opção B (mais seguro):** Atlas Private Endpoint (precisa upgrade pago).

### 1.4 Pegar a connection string

1. Sidebar **Database → Connect → Drivers → Node.js**.
2. Copie a URI no formato:
   ```
   mongodb+srv://USERNAME:PASSWORD@CLUSTER-URL/?retryWrites=true&w=majority
   ```
3. Substitua `<password>` pela senha gerada no 1.2.
4. Adicione o nome do DB antes do `?`:
   ```
   mongodb+srv://USERNAME:PASSWORD@CLUSTER-URL/controle-de-acesso?retryWrites=true&w=majority
   ```

Guarde como **`MONGODB_URI`**.

---

## 2. Upstash Redis

### 2.1 Criar database

1. Login em [console.upstash.com](https://console.upstash.com).
2. **Create Database**.
3. Name: `controle-de-acesso-blocklist`.
4. Type: **Regional** (não Global — single-region é suficiente e mais barato).
5. Region: **sa-east-1 (São Paulo)** ou a mais próxima da region do Atlas.
6. **TLS:** Enabled (default). Eviction: **noeviction** (não queremos perder JWTs revogados).
7. **Create**.

### 2.2 Pegar a connection string

Na página do DB criado, copie o campo **Endpoint** (formato Redis URL):

```
rediss://default:TOKEN@HOSTNAME.upstash.io:6379
```

Note: protocolo é **`rediss://`** (com 2 `s` — TLS). O ioredis aceita TLS automaticamente quando vê esse scheme.

Guarde como **`REDIS_URL`**.

> 💡 A free tier permite ~10k commands/dia. Para esta API (1 SET por logout + 1 EXISTS por request autenticado), comporta uns 5k req/dia confortavelmente.

---

## 3. Vercel

### 3.1 Importar o repo

1. Login em [vercel.com](https://vercel.com).
2. **Add New → Project → Import** o repo `diego64/controle-de-acesso`.
3. Framework Preset: **Other** (deixe Vercel detectar pelo `vercel.json`).
4. Root Directory: `./` (raiz).
5. **NÃO clique em Deploy ainda** — falta env vars.

### 3.2 Configurar env vars

Aba **Environment Variables** do projeto. Adicione todas para o environment **Production** (e opcionalmente Preview):

| Var               | Valor                      | Notas                                                |
| ----------------- | -------------------------- | ---------------------------------------------------- |
| `NODE_ENV`        | `production`               | já no vercel.json também                             |
| `PORT`            | `3000`                     | cosmético — Vercel ignora, mas Zod exige             |
| `LOG_LEVEL`       | `info`                     |                                                      |
| `MONGODB_URI`     | `mongodb+srv://ca_app:...` | do passo 1.4                                         |
| `REDIS_URL`       | `rediss://default:...`     | do passo 2.2                                         |
| `JWT_SECRET`      | `<gerar>`                  | `openssl rand -hex 32` no terminal — 64 chars        |
| `JWT_EXPIRES_IN`  | `15m`                      |                                                      |
| `HASH_ITERATIONS` | `100000`                   |                                                      |
| `HASH_KEYLEN`     | `64`                       |                                                      |
| `HASH_DIGEST`     | `sha512`                   |                                                      |
| `CORS_ORIGIN`     | `https://app.example.com`  | OBRIGATÓRIO em prod; cole a origem real do seu front |

**Por CLI** (alternativa):

```bash
vercel env add MONGODB_URI production
# cola o valor, repete pros outros
```

### 3.3 Deploy

1. **Deploy** (ou push pra `main` se já tiver auto-deploy ativado).
2. Aguardar build (~2 min na primeira vez): pnpm install → `pnpm build` (tsc + tsc-alias) → empacotar `api/index.ts` + `dist/**`.
3. Vercel atribui uma URL `controle-de-acesso-*.vercel.app`.

### 3.4 Smoke test

```bash
# Substituir URL conforme o que o Vercel atribuiu
APP=https://controle-de-acesso-xxxxx.vercel.app

# Health probes
curl -i $APP/health/live
# Esperado: 200 {"status":"ok",...}

curl -i $APP/health/ready
# Esperado: 200 com services.mongodb=ok e services.redis=ok
# Se 503 — checar env vars (Atlas IP whitelist? Upstash URL com rediss://?)

# Headers de segurança (helmet)
curl -sS -D - $APP/health/live -o /dev/null | grep -iE "(strict-transport|x-content|x-frame|content-security)"

# Registrar + login
curl -X POST $APP/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@prod.test","password":"prod-smoke-12345","firstName":"Smoke","lastName":"Test"}'

curl -X POST $APP/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@prod.test","password":"prod-smoke-12345"}'
# Esperado: 200 {"accessToken":"eyJ...","expiresIn":"15m"}
```

---

## 4. Promover primeiro admin em produção

A API **não expõe endpoint** para promover usuários a `ADMINISTRADOR` (decisão de segurança documentada em `CLAUDE.md`). Use `mongosh` direto contra o Atlas:

```bash
# Instalar mongosh local ou usar via Docker
docker run --rm -it mongo:7 mongosh \
  "mongodb+srv://USERNAME:PASSWORD@CLUSTER-URL/controle-de-acesso?retryWrites=true&w=majority" \
  --eval 'db.users.updateOne({email:"voce@empresa.com"},{$set:{role:"ADMINISTRADOR"}})'
```

A mudança vale **imediatamente** — `requireRole` consulta o DB a cada request.

---

## 5. Pós-deploy — observabilidade cloud

A folder `Cloud` dos dashboards Grafana (em `infra/grafana/dashboards/cloud/`) já está provisionada **localmente** apontando pra um datasource `Prometheus-Cloud` que está em placeholder. Para conectar ao Vercel + Atlas:

### 5.1 Vercel Metrics (Pro plan)

Se tiver Vercel Pro:

1. Project Settings → **Observability → Metrics**.
2. Endpoint Prometheus disponível em `https://api.vercel.com/v1/projects/<id>/metrics`.
3. Apontar `GRAFANA_CLOUD_PROMETHEUS_URL` para esse endpoint + token.

### 5.2 Atlas Prometheus Integration

1. Atlas → **Project Settings → Integrations → Prometheus**.
2. Habilitar e copiar o discovery URL.
3. Adicionar scrape no Prometheus cloud:
   ```yaml
   - job_name: mongodb-atlas
     scrape_interval: 60s
     basic_auth:
       username: ${ATLAS_USER}
       password: ${ATLAS_API_KEY}
     static_configs:
       - targets:
           [
             "https://cloud.mongodb.com/prometheus/v1.0/groups/<group-id>/discovery",
           ]
   ```

### 5.3 Atualizar `infra/.env`

```bash
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX.grafana.net/api/prom
GRAFANA_CLOUD_PROMETHEUS_USER=<conta>
GRAFANA_CLOUD_PROMETHEUS_PASSWORD=<api-key>
```

Recarregar Grafana local:

```bash
docker compose -f infra/docker-compose.yml restart grafana
```

---

## 6. CORS

Em produção, `CORS_ORIGIN` é **obrigatório** (sem ele, browsers bloqueiam). Atualizar conforme cada front:

```bash
# Adicionar nova origem permitida via Vercel CLI
vercel env rm CORS_ORIGIN production
vercel env add CORS_ORIGIN production
# Cola: https://app.example.com,https://admin.example.com
```

Trigger redeploy pra pegar a mudança:

```bash
vercel --prod
```

---

## 7. Troubleshooting

| Sintoma                                            | Causa provável                                                 | Resolver                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Deploy quebra em `pnpm build`                      | TypeScript error em produção que não pegou localmente          | Rodar `pnpm type-check` antes do push                                                                   |
| `/health/ready` retorna `mongodb: down`            | Atlas IP not whitelisted                                       | Aba Network Access → confirmar `0.0.0.0/0` (ou IPs Vercel)                                              |
| `/health/ready` retorna `redis: down`              | URL Upstash sem `rediss://` (TLS)                              | Confirmar scheme `rediss://` e não `redis://`                                                           |
| Cold start > 5s                                    | DUMMY_PASSWORD_HASH + connect inicial                          | Esperado no 1º hit; subsequentes < 200ms. Considerar Edge runtime se virar problema.                    |
| `500 INTERNAL_ERROR` em qualquer rota              | env var faltando                                               | `vercel env ls production` — comparar com `.env.example`                                                |
| Lambda timeout (10s) em PBKDF2                     | Hash sync bloqueia 100ms; sob carga concorrente, lambda satura | Aumentar `maxDuration` em vercel.json OU mover pra `pbkdf2` async                                       |
| `429 Too Many Requests` em /login após poucos hits | trustProxy: true + IP do Vercel é stable                       | Comportamento esperado de rate-limit. Reduzir/ajustar `config.rateLimit` no controller se for legítimo. |

---

## 8. Rollback rápido

Vercel mantém histórico de deploys. Em incidente:

```bash
# Listar últimos deploys
vercel ls

# Promover um deploy anterior pra production
vercel promote <deployment-url> --scope=<team>
```

Ou via UI: **Deployments → ... → Promote to Production**.

---

## Checklist final

- [ ] Atlas cluster M0 criado, IP whitelist `0.0.0.0/0`, user `ca_app`.
- [ ] `MONGODB_URI` capturado com `?retryWrites=true&w=majority`.
- [ ] Upstash Redis criado, TLS habilitado.
- [ ] `REDIS_URL` no formato `rediss://default:<token>@...`.
- [ ] 11 env vars cadastradas no Vercel (production).
- [ ] `JWT_SECRET` gerado fresh via `openssl rand -hex 32` (não reusar de dev).
- [ ] Build OK na UI do Vercel.
- [ ] `GET /health/live` retorna 200.
- [ ] `GET /health/ready` retorna 200 com `mongodb: ok` e `redis: ok`.
- [ ] `POST /auth/register` + `/login` funcionam end-to-end.
- [ ] Primeiro admin promovido via mongosh.
- [ ] `CORS_ORIGIN` apontando para a origem real do front.
