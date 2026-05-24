# Runbook: Latência p95 /auth/register > 500ms

**Severity:** `warning`
**SLO violado:** [Latência p95 register < 500ms](../architecture.md#slos)
**Alerta:** `slo-register-latency-high` (firado quando p95 dos últimos 5m > 0.5s por 5min).

## TL;DR

Registro está lento. Caminho crítico: validate body → `repo.findByEmail` (read) → `hashPassword` (PBKDF2 sync ~100ms) → `repo.create` (write). Mais lento que login porque envolve **write** ao Mongo (com índice único checando duplicata) em vez de read.

## Diagnose (ordem)

### 1. Mesma diagnose de login + verificar writes
Comece pelo [Runbook de login latency](./slo-login-latency-high.md) — as causas se sobrepõem. Adicionalmente:

### 2. Writes do Mongo
```
rate(mongodb_op_counters_total{type="insert"}[1m])
rate(mongodb_op_counters_total{type="update"}[1m])
```
- Insert latência alta + counter normal → contenção de write lock.
- Insert errors → duplicate-key races (esperado para email duplicado, mas se >1% pode indicar bug).

### 3. Health do índice único
```bash
docker exec ca-mongodb mongosh -u ca_admin -p "$MONGO_PASS" \
  --authenticationDatabase admin controle-de-acesso \
  --eval '
    db.users.getIndexes();
    db.users.stats().indexSizes;
    db.users.aggregate([
      { $indexStats: {} },
      { $project: { name: 1, "accesses.ops": 1 } }
    ]).toArray();
  '
```
- Sem índice `{email:1}` único → registros lentos + corrida TOCTOU. **Recriar imediato.**
- `accesses.ops` baixo apesar de muito tráfego → queries não estão usando o índice (raro pra Mongoose).

### 4. Tamanho da collection
```
db.users.estimatedDocumentCount()
db.users.stats().size
```
Collection >1M docs sem sharding começa a sentir.

## Causas prováveis

1. **PBKDF2 sync** (igual ao login — mesmo gargalo, ver runbook de login).
2. **Índice único em email corrompido/perdido** após restore do backup ou migration mal-executada.
3. **Write lock contention** quando muitos registros simultâneos em janela curta (raro em produção real, comum em load test).
4. **Replicaset write concern w:majority** demorando — secundário lento.
5. **TOCTOU race**: muitos clientes registrando o mesmo email caem no `findOne` cache → tentam `create` → 11000 → repository converte pra 409. Cada falha custa 1 round-trip extra.

## Mitigação

### Quick fix
- Mesmo do login: scale horizontal, baixar rate-limit, restart Mongo se isolado.
- **Recriar índice se perdido:**
  ```js
  db.users.createIndex({ email: 1 }, { unique: true, background: true })
  ```
  Em produção, use `background: true` pra não bloquear ops.

### Fix duradouro
- **`hashPassword` async** (mesmo do login).
- **Eliminar findOne pré-insert**: confiar no índice único + tratar 11000 como caminho principal. Reduz 1 round-trip por registro.
  ```ts
  // src/modules/auth/auth.service.ts — registerUser
  // Skip findByEmail; deixar create() rejeitar com 11000 se duplicado.
  ```
  Trade-off: perde a checagem early-return; latência média sobe ligeiramente em duplicates legítimos, cai significativamente em criações novas (caso 99%).
- **Connection pool size** maior se writes batem teto.

## Escalação

- Mesmas regras do login: p99 > 1.5s ou 30min firando → backend.
- Combinado com `error-rate-high` indicando 5xx em /register → tratar como incidente.

## Links

- [SLO definition](../architecture.md#slos)
- [Runbook login latency](./slo-login-latency-high.md) — causas comuns
- [docs/database.md — User Schema](../database.md)
