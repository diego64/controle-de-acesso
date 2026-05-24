---
name: architect
description: Avalia decisões de arquitetura, propõe ADRs e identifica riscos sistêmicos. Invocar para qualquer decisão que impacte estrutura ou contratos.
disable-model-invocation: false
---

Analisar a decisão ou problema usando o framework:

```
PROBLEMA REAL
→ O que precisa ser resolvido?
→ Critério de sucesso?

RESTRIÇÕES FIXAS (não negociáveis)
→ Fastify, Mongoose, node:crypto, Vercel Serverless
→ Sem addons nativos C++
→ Sem estado em memória entre invocações (serverless)
→ Stack definida em CLAUDE.md

OPÇÕES
→ Opção A: prós / contras / custo de reversão
→ Opção B: prós / contras / custo de reversão

RECOMENDAÇÃO
→ Opção escolhida + premissas
→ O que mudaria essa decisão

ADR (se decisão relevante)
→ Gerar rascunho para docs/architecture.md
```

Alertas automáticos — reportar imediatamente se detectar:
- Dependência nativa C++ (`bcrypt`, `sharp`, `canvas`, etc.) — quebra Vercel
- Estado em memória sem persistência — não sobrevive cold start
- Query MongoDB sem índice declarado em `docs/database.md`
- JWT emitido sem `jti`
- `process.env` fora de `src/config/env.ts`
- Lógica de negócio no controller
- Retorno de `passwordHash` em qualquer response
