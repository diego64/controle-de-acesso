# Runbook: Taxa de erro 5xx > 0.5%

**Severity:** `critical`
**SLO violado:** [Taxa de erro 5xx < 0.5%](../architecture.md#slos)
**Alerta:** `slo-error-rate-high` (firado quando ratio 5xx/total > 0.5% nos últimos 5m, por 5min).

## TL;DR

A API está retornando 5xx além do orçamento. Isso significa código não-tratado virou `INTERNAL_ERROR` em vez de erro de domínio (`AppError`). Causas comuns: deploy quebrado, dep externa fora do ar, query inesperada que lança CastError/TimeoutError.

## Diagnose (ordem)

### 1. Quais rotas estão errando?
```
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) by (route, status_code)
```
- Concentrado em **1 rota** → bug isolado, abrir o handler dessa rota.
- Espalhado em **todas** → infra (Mongo down, Redis down, OOM iminente, deps esgotadas).

### 2. Health do sistema
```bash
curl -s http://localhost:3000/health/ready | jq
```
- `mongodb: down` → blocklist/reads/writes falhando → todas as rotas autenticadas e auth quebram.
- `redis: down` → rate-limit + blocklist quebram.

### 3. Logs de erro recentes (com stack)
```bash
docker logs ca-app --tail 500 --since 30m 2>&1 | \
  grep -E "(unhandled|INTERNAL_ERROR|Error:|stack)" | head -40
```
O `errorHandler.ts:setErrorHandler` loga TODO erro inesperado com `err.stack` via `request.log.error(...)`. Procure pelo padrão `"msg":"unhandled error"`.

### 4. Quais códigos exatos?
```
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) by (status_code)
```
- **500 INTERNAL_ERROR**: stack trace dirá. Caminhos comuns: CastError do Mongoose, TypeError em propriedade undefined, timeout do driver.
- **503**: vem do `/health/ready` quando Mongo ou Redis estão down. Não conta como bug da app, é sinal.

### 5. Correlacionar com deploy
```bash
docker inspect ca-app | jq '.[0].Created'
```
Se o erro começou ~1min após esse timestamp, é regressão do deploy. **Rollback imediato** (ver "Quick fix").

## Causas prováveis

1. **Mongoose CastError** em `findById(request.user.id)` quando `sub` do JWT não é ObjectId hex de 24 chars.
   - Sintoma: 500 em `/auth/me`, `/users`, `/auth/logout` (qualquer guard que faz lookup pelo id).
   - Causa: JWT forjado/manipulado com sub inválido, ou migração que mudou o formato de id.
   - **Fix:** adicionar try/catch no middleware/controller convertendo CastError em `AppError('TOKEN_INVALID', 401)`. Conhecido — ver code review.
2. **Mongo cluster particionado**: queries dão timeout após `serverSelectionTimeoutMS:5000`, viram 500.
3. **Redis fora**: `blocklist.has()` rejeita após maxRetriesPerRequest, vira 500 em `authenticate`. Conhecido — fail-policy não definida.
4. **Schema response inválido**: `toDTO` retorna `createdAt: undefined` (doc legado sem timestamps) → fast-json-stringify falha → 500.
5. **OOM iminente**: app começa a falhar uncaught antes de morrer; healthcheck ainda OK.
6. **Deploy quebrado**: bug introduzido no último push.

## Mitigação

### Quick fix (P0)

**Rollback de deploy** (se erro coincide com deploy recente):
```bash
# Identificar imagem anterior
docker images infra-app --format "{{.ID}}\t{{.CreatedAt}}" | sort -k2 -r | head -3

# Recriar com a anterior
docker tag <previous-sha> infra-app:latest
docker compose -f infra/docker-compose.yml up -d --force-recreate app
```

**Mongo/Redis fora** → restart do container afetado:
```bash
docker compose -f infra/docker-compose.yml restart mongodb redis
```

**Burst de CastError** (JWT forjados):
- Verificar se JWT_SECRET vazou em logs/repo recentemente. Se sim, **rotacionar imediato**:
  ```bash
  # Gerar novo secret
  NEW_SECRET=$(openssl rand -hex 32)
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_SECRET}/" infra/.env
  docker compose -f infra/docker-compose.yml restart app
  ```
  Todos os tokens emitidos com o secret antigo viram inválidos imediatamente — usuários precisam relogar. **Documentar comunicação ao time.**

### Fix duradouro

- **CastError handling**: adicionar guard no `errorHandler.ts`:
  ```ts
  if (error.name === 'CastError') {
    return reply.status(401).send({
      statusCode: 401, error: 'TOKEN_INVALID',
      message: 'Identificador inválido'
    })
  }
  ```
- **Fail-policy do Redis**: decidir entre fail-open (deixa passar quando Redis down) ou fail-closed (rejeita tudo). Documentar em `docs/security.md`.
- **Validação de timestamps no toDTO**: se `doc.createdAt == null`, retornar fallback ou logar warning explícito.

## Escalação

- **Error rate > 5%** ou **firando por > 15min** → escalar pra time de backend + abrir incident channel.
- **Combinado com `slo-availability-low`** → tratar como incidente sistêmico, comunicar status page.

## Links

- [SLO definition](../architecture.md#slos)
- [Dashboard SLOs](http://localhost:3001/d/local-slos) — painéis "Status codes" e "Taxa de erro 5xx"
- [docs/security.md — JWT](../security.md#jwt)
- [.claude/rules/error-handling.md](../../.claude/rules/error-handling.md) — códigos canônicos
- Alertas relacionados: [slo-availability-low](./slo-availability-low.md) (causa comum compartilhada)
