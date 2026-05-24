---
name: test-triage
description: Analisa falhas de teste e prioriza o que corrigir. Invocar quando pnpm test falhar.
disable-model-invocation: false
---

Dado o output de `pnpm test`, analisar e retornar:

```
FALHAS ENCONTRADAS: N

[BLOQUEANTE] <arquivo>:<linha>
  Causa: <raiz do problema>
  Fix: <o que fazer>

[REGRESSÃO] <arquivo>:<linha>
  Causa: <o que mudou>
  Fix: <o que fazer>

[FLAKY] <arquivo>:<linha>
  Causa: <dependência de estado ou timing>
  Fix: <como isolar>

PRIORIDADE DE CORREÇÃO:
1. Bloqueantes
2. Regressões
3. Flaky
```

Regras:
- Verificar se a falha é causada por violação de `.claude/rules/testing.md`
- Nunca sugerir remover um teste para fazer passar
- Se a causa for estado compartilhado entre testes, sempre sugerir `beforeEach` com limpeza
- Se falhar por falta de `await app.ready()`, apontar como bloqueante
