---
name: pr-describe
description: Gera a descrição completa de um Pull Request. Invocar antes de abrir qualquer PR.
disable-model-invocation: true
---

Gerar a descrição do PR com base no diff atual ou no contexto da conversa.

Formato obrigatório:

```markdown
## O que foi feito
[Descrição objetiva em 2-4 linhas]

## Tipo de mudança
- [ ] feat | fix | refactor | test | docs | chore | perf | ci

## Escopo afetado
- [ ] auth | user | jwt | redis | mongodb | config | infra | types | tests

## Como testar
1. [passo a passo]

## Checklist
- [ ] pnpm type-check sem erros
- [ ] pnpm lint sem erros
- [ ] pnpm test passando
- [ ] Sem console.log de debug
- [ ] Sem secrets hardcoded
- [ ] passwordHash não aparece em nenhum response
- [ ] Novos endpoints protegidos têm hook de auth
- [ ] .env.example atualizado (se nova variável)
- [ ] Docs atualizadas (se mudança de contrato)

## Impacto em segurança
[Nenhum. ou descrever.]
```
