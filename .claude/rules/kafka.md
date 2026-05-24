# Rule: Kafka / Mensageria

## Status atual

**Esta API NÃO usa Kafka.** Redis é usado apenas para blocklist JWT e rate limiting.

Consultar `docs/events.md` para contratos de eventos futuros e o processo de adoção.

## Quando este arquivo for ativado

Se Kafka for introduzido, as regras abaixo se aplicam:

### Headers obrigatórios em toda mensagem
- `x-correlation-id` — UUID v4 gerado no request original
- `x-source-service` — sempre `controle-de-acesso`
- `x-event-version` — ex: `"1.0"`

### Idempotência
- Consumidores devem tolerar redelivery
- Usar `jti` ou `correlationId` como chave de deduplicação
- Nunca processar o mesmo evento duas vezes (verificar no Redis ou MongoDB)

### Referência de eventos
Ver `docs/events.md` para schemas TypeScript completos.

### Nunca publicar em Kafka
- Dados sensíveis (senhas, tokens, PII além do userId)
- Eventos sem schema documentado em `docs/events.md`
