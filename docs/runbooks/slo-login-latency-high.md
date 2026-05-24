# Runbook: Latência p95 /auth/login > 300ms

**Severity:** `warning`
**SLO violado:** [Latência p95 login < 300ms](../architecture.md#slos)
**Alerta:** `slo-login-latency-high` (firado quando p95 dos últimos 5m > 0.3s por 5min).

## TL;DR

Login está lento. O caminho crítico é: parse body → `repo.findByEmailWithPassword` (1 query Mongo) → `verifyPassword` (PBKDF2 ~100ms síncrono) → `sign` (rápido). Cada um desses pode ser o gargalo.

## Diagnose (ordem)

### 1. É um spike ou drift?
No dashboard `Local/SLOs` → painel "Latência p95 por rota", comparar janelas:
- **Spike isolado** (passou agora) → provavelmente carga transitória; observe próxima janela.
- **Steady drift** ao longo de horas → algo degradou em prod (Mongo, índice perdido, deploy).

### 2. Rate de tráfego correspondente
```
sum(rate(http_request_duration_seconds_count{route="/auth/login"}[1m]))
```
- **Alto** (>20 req/s sustentado) → PBKDF2 sync está saturando event loop. Veja "PBKDF2 satura single thread" abaixo.
- **Baixo** + latência alta → Mongo/network gargalo, não CPU.

### 3. Mongo está lento?
```
# No dashboard Banco de Dados:
rate(mongodb_op_counters_total[1m])  # ops/s
mongodb_connections{state="current"}  # pool usage
```
- Conexões = maxPoolSize (10 default) → repository bloqueando esperando conexão.
- `mongodb_op_counters_total{type="query"}` subindo desproporcional → query lenta.

### 4. Quebra por rota (top slow)
No dashboard SLOs, tabela "Top rotas por p95" — se outras rotas também estão lentas, é problema sistêmico (CPU, GC, Mongo). Se só `/auth/login` está lento, é específico do hash/verify.

### 5. Logs slow query no Mongo
```bash
docker exec ca-mongodb mongosh -u ca_admin -p "$MONGO_PASS" \
  --authenticationDatabase admin \
  --eval 'db.setProfilingLevel(1, {slowms: 100}); db.system.profile.find().sort({ts:-1}).limit(5).pretty()' \
  controle-de-acesso
```

## Causas prováveis

1. **PBKDF2 sync satura single thread** (mais comum sob carga).
   - `verifyPassword` é `pbkdf2Sync` (~100ms em 100k iter). 10 logins paralelos = thread bloqueada 1s.
   - Sintoma: outras rotas também ficam lentas mesmo sem tráfego nelas (event loop lag).
   - Métrica: `nodejs_eventloop_lag_seconds` no /metrics.
2. **Índice em `email` desapareceu** ou Mongo não está usando.
   - `db.users.getIndexes()` deve mostrar `{ email: 1 }` único. Se não, recriar.
3. **DUMMY_PASSWORD_HASH defesa de timing**: usuários inexistentes ainda pagam PBKDF2. Sob brute-force, latência infla.
4. **Conexão Mongo saturada**: maxPoolSize=10. Sob carga, `findByEmailWithPassword` enfileira.
5. **Rate-limit Redis lento** (`@fastify/rate-limit` faz 1-2 ops Redis por request).
   - Verifique latência Upstash/Redis Cloud no dashboard infra correspondente.

## Mitigação

### Quick fix
- **Spike de tráfego legítimo** → aumentar replicas (horizontal scale). PBKDF2 não escala em 1 thread Node.
- **Brute-force suspeito** → temporariamente baixar `max` do rate-limit em login pra 3/min:
  ```ts
  // src/modules/auth/auth.controller.ts
  config: { rateLimit: { max: 3, timeWindow: '1m' } }
  ```
  Deploy emergencial; abrir issue pra revisão.
- **Mongo lento isolado** → restart do container Mongo (cuidado: rola eleição em replicaset):
  ```bash
  docker compose -f infra/docker-compose.yml restart mongodb
  ```

### Fix duradouro
- **Migrar `verifyPassword` para versão async** (`pbkdf2` em vez de `pbkdf2Sync`) — libera event loop entre requests. Custo: refactor pequeno, breaking nada.
- **Aumentar `maxPoolSize`** no mongoose plugin se conexões são gargalo.
- **Cache de findByEmail** com TTL curto (5s) — Redis lookup é mais barato que Mongo. Cuidado com staleness.

## Escalação

- **p99 > 1s** ou **alerta firando por > 30min** → escalar pra time de backend.
- **Correlato com outros alertas** (error-rate, availability) → tratar como incidente sistêmico.

## Links

- [SLO definition](../architecture.md#slos)
- [Dashboard SLOs](http://localhost:3001/d/local-slos)
- [Dashboard Banco de Dados](http://localhost:3001/d/local-banco-de-dados)
- [docs/security.md — PBKDF2](../security.md#hashing-de-senha-pbkdf2)
- Alertas relacionados: [slo-register-latency-high](./slo-register-latency-high.md) (mesma causa raiz comum)
