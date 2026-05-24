---
name: pr-review
description: Executa review completo de um PR aplicando todas as rules do projeto. Invocar antes de aprovar qualquer PR.
disable-model-invocation: true
---

Revisar o PR com base nas rules de `.claude/rules/` e retornar:

```
PR: [título]
DECISÃO: APROVADO | REQUER ALTERAÇÕES | BLOQUEADO

PROBLEMAS CRÍTICOS (bloqueiam merge):
- [arquivo:linha] problema + como corrigir

MELHORIAS SUGERIDAS (não bloqueiam):
- [arquivo:linha] sugestão

POSITIVOS:
- [o que está bem feito]
```

Checklist obrigatório de revisão:

**TypeScript**
- [ ] Sem `any` sem justificativa
- [ ] Named exports em módulos internos
- [ ] Tipos explícitos em parâmetros e retornos públicos

**Service**
- [ ] Sem `FastifyRequest` / `FastifyReply`
- [ ] Dependências por parâmetro
- [ ] Erros via `AppError`

**Controller**
- [ ] Sem lógica de negócio
- [ ] DTO explícito no response
- [ ] Schema declarado na rota

**Repository**
- [ ] `.lean()` nas queries de leitura
- [ ] `passwordHash` com `select: false` respeitado
- [ ] Interface implementada corretamente

**Segurança**
- [ ] Sem `process.env` direto
- [ ] Sem `passwordHash` em response
- [ ] `jti` presente nos JWTs emitidos
- [ ] Rate limit em endpoints de auth
- [ ] Sem `bcrypt`

**Testes**
- [ ] Padrão AAA
- [ ] `beforeEach` limpa collections
- [ ] `await app.ready()` antes de inject
- [ ] Sem banco real nos testes unitários
