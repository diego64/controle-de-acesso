# Runbook: Disponibilidade abaixo de 99.5%

**Severity:** `critical`
**SLO violado:** [Disponibilidade ≥ 99.5% mensal](../architecture.md#slos)
**Alerta:** `slo-availability-low` (firado quando `avg_over_time(up{job="controle-de-acesso"}[1h]) * 100 < 99.5` por 5min).

## TL;DR

A API está fora do ar ou inalcançável pelo Prometheus em pelo menos parte do tempo na última hora. Cada minuto down já come orçamento de erro mensal (~21min/mês para 99.95%, ~3.6h/mês para 99.5%).

## Diagnose (ordem)

### 1. App está vivo?
```bash
curl -i http://localhost:3000/health/live
# Esperado: 200 {"status":"ok",...}
```
- **5xx ou timeout** → app crashou ou está hung. Pula pra "Causas prováveis: app crashed".
- **200** → app responde mas Prometheus não enxerga. Pula pra "Prometheus não consegue scrapear".

### 2. App está saudável (deps OK)?
```bash
curl -s http://localhost:3000/health/ready | jq
# {"status":"ok","services":{"mongodb":"ok","redis":"ok"},...}
```
- `mongodb: "down"` → Mongo indisponível → blocklist E persistência falham.
- `redis: "down"` → Redis indisponível → rate-limit fail-open + blocklist invisível.

### 3. Prometheus enxerga o target?
```bash
curl -s http://localhost:9090/api/v1/targets | \
  jq '.data.activeTargets[] | select(.labels.job=="controle-de-acesso") | {health, lastError, lastScrape}'
```
- `health: "down"` + `lastError` populado → network / scrape config.
- `health: "up"` + alerta firando → Prometheus está scraping mas a app reporta `up=0` (raro).

### 4. Logs da app
```bash
docker logs ca-app --tail 200 --since 1h | grep -E "(fatal|error|FATAL|ERROR)"
```

### 5. Container status
```bash
docker ps -a --filter "name=ca-app" --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"
docker inspect ca-app -f '{{.State.RestartCount}} restarts | OOMKilled={{.State.OOMKilled}}'
```

## Causas prováveis

1. **App crashou** (uncaught exception, OOM, panic em pbkdf2).
   - `docker inspect ca-app | jq '.[0].State'` mostra OOMKilled ou ExitCode != 0.
2. **Deploy quebrou** (último build mete env errada, mongo URI inválida).
   - Compara `docker logs ca-app --tail 50` com últimos deploys.
3. **Mongo/Redis down** afetando readiness probe → orquestrador reinicia → ciclo restart.
4. **Network split**: Prometheus em rede separada não chega ao app.
   - `docker exec ca-prometheus wget -O- http://host.docker.internal:3000/metrics`
5. **Endpoint /metrics removido por mudança recente** (regressão).

## Mitigação

### Quick fix (P0)
```bash
# Reiniciar app preservando dados
docker compose -f infra/docker-compose.yml restart app

# Se restart não pega, recriar do zero
docker compose -f infra/docker-compose.yml up -d --force-recreate app
```

### Mongo/Redis down
```bash
# Status dos containers
docker compose -f infra/docker-compose.yml ps

# Restart do que está unhealthy
docker compose -f infra/docker-compose.yml restart mongodb redis
```

### Rollback de deploy
```bash
# Identificar imagem anterior
docker images infra-app --format "{{.ID}} {{.CreatedAt}}"

# Recriar com a anterior
docker compose -f infra/docker-compose.yml down app
docker tag <previous-sha> infra-app:latest
docker compose -f infra/docker-compose.yml up -d app
```

### Fix duradouro
- Se OOMKilled recorrente: aumentar `mem_limit` no compose ou investigar memory leak.
- Se loops de restart: configurar `healthcheck` com `start_period` maior; ajustar `restart` policy.
- Se Mongo flaky: verificar índices, particionamento, conexão pooled.

## Escalação

- **>15min downtime** ou **2+ ocorrências em 24h** → escalar pro time de infra/SRE.
- **Cliente reportando**: pular direto pro quick fix; logar ação no incident channel.

## Links

- [SLO definition](../architecture.md#slos)
- [Dashboard SLOs (Local)](http://localhost:3001/d/local-slos)
- [Dashboard Ambiente Geral (Local)](http://localhost:3001/d/local-ambiente-geral)
- Alertas relacionados: [slo-error-rate-high](./slo-error-rate-high.md) (sintoma correlato)
