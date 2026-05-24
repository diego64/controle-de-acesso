# Events — controle-de-acesso

> Esta API não publica eventos Kafka na versão atual. Este arquivo existe como contrato para
> integrações futuras e para documentar os eventos de domínio que PODERIAM ser emitidos.

## Status atual

**Sem mensageria.** Redis é usado apenas para blocklist de JWT e rate limiting.
Se integração com Kafka for necessária, criar ADR em `docs/architecture.md` antes de implementar.

## Eventos de domínio (futuros)

### `user.registered`
```typescript
{
  eventType: 'user.registered',
  version: '1.0',
  timestamp: string,        // ISO 8601
  payload: {
    userId: string,
    email: string,
    createdAt: string
  }
}
```
**Quando emitir:** após persistir usuário com sucesso no MongoDB.
**Consumidores potenciais:** serviço de email (boas-vindas), auditoria.

### `user.login_failed`
```typescript
{
  eventType: 'user.login_failed',
  version: '1.0',
  timestamp: string,
  payload: {
    email: string,
    ip: string,
    reason: 'invalid_credentials' | 'rate_limited'
  }
}
```
**Quando emitir:** após falha de autenticação.
**Consumidores potenciais:** serviço de segurança / alerta de brute force.

### `user.token_revoked`
```typescript
{
  eventType: 'user.token_revoked',
  version: '1.0',
  timestamp: string,
  payload: {
    userId: string,
    jti: string
  }
}
```
**Quando emitir:** logout explícito.

## Convenções (para quando Kafka for adotado)

- Headers obrigatórios: `x-correlation-id`, `x-source-service`
- Idempotência: consumidores devem tolerar redelivery por `jti` ou `correlationId`
- Schema: TypeScript types como fonte de verdade, sem Avro nesta fase
