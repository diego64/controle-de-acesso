# Command: /test-triage

Analisa falhas de teste e prioriza o que corrigir primeiro.

## Como usar

Colar o output do `pnpm test` e executar `/test-triage`.

## O que o comando faz

1. Classifica falhas em: `bloqueante`, `regressão`, `flaky`, `novo`
2. Identifica a causa raiz provável
3. Sugere ordem de correção por impacto
4. Aponta se alguma falha é sintoma de problema maior

## Output esperado

```
FALHAS ENCONTRADAS: N

[BLOQUEANTE] auth.service.test.ts:45
  Causa: AppError não está sendo lançada para email duplicado
  Fix: Verificar se repo.findByEmail está retornando o mock correto

[REGRESSÃO] login.test.ts:23
  Causa: Campo 'expiresIn' ausente no response — mudança de schema?
  Fix: Verificar auth.schema.ts e controller de login

PRIORIDADE DE CORREÇÃO:
1. Bloqueantes (impedem merge)
2. Regressões (comportamento mudou)
3. Flakey (isolar e estabilizar)
```
