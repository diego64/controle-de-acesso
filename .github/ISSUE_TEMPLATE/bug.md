---
name: Bug Report
about: Comportamento inesperado na API
title: 'fix(<escopo>): '
labels: bug
assignees: ''
---

## Descrição

<!-- O que está acontecendo vs o que deveria acontecer -->

## Para reproduzir

```bash
# Curl ou passo a passo mínimo para reproduzir
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "...", "password": "..." }'
```

## Response atual

```json
// Cole o response recebido
```

## Response esperado

```json
// Cole o response esperado
```

## Ambiente

- Node.js: 
- Commit/branch: 
- LOCAL / CI / PRODUÇÃO: 

## Logs relevantes

```
// Cole logs do pino se disponível
```
