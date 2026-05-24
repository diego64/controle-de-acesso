# Runbooks

Procedimentos de diagnóstico e mitigação para cada alerta firado.

Cada runbook é referenciado via `runbook_url` na annotation do alerta correspondente em `infra/grafana/provisioning/alerting/rules.yaml`. Ao receber a notificação (webhook), o link aparece direto.

## Convenção

Cada runbook tem:
- **TL;DR** — o que o alerta significa em uma frase.
- **SLO violado** — link pra `docs/architecture.md#slos`.
- **Diagnose** — comandos/queries prontos pra copiar.
- **Causas prováveis** — em ordem de frequência observada.
- **Mitigação** — quick fix → fix duradouro.
- **Escalação** — quando paginar.

## Alertas → Runbook

| Alerta | Severity | Runbook |
|---|---|---|
| `Disponibilidade abaixo de 99.5% (1h)` | critical | [slo-availability-low.md](./slo-availability-low.md) |
| `Latência p95 /auth/login > 300ms` | warning | [slo-login-latency-high.md](./slo-login-latency-high.md) |
| `Latência p95 /auth/register > 500ms` | warning | [slo-register-latency-high.md](./slo-register-latency-high.md) |
| `Taxa de erro 5xx > 0.5%` | critical | [slo-error-rate-high.md](./slo-error-rate-high.md) |

## Atalhos úteis

```bash
# Logs da app (em container)
docker logs ca-app --tail 200 -f

# Health da app
curl http://localhost:3000/health/ready

# Métricas raw
curl http://localhost:3000/metrics | grep -E "^http_request"

# Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health}'

# Grafana — alertas firando agora
curl -s -u admin:$GRAFANA_PASS http://localhost:3001/api/prometheus/grafana/api/v1/alerts | jq

# Mongo shell (dentro do container)
docker exec ca-mongodb mongosh -u ca_admin -p "$MONGO_PASS" \
  --authenticationDatabase admin controle-de-acesso
```
