# Command: /pr-describe

Gera a descrição completa de um Pull Request com base no diff ou no contexto da conversa atual.

## Output esperado

```markdown
## O que foi feito
[Descrição objetiva das mudanças em 2-4 linhas]

## Tipo de mudança
- [ ] feat — nova funcionalidade
- [ ] fix — correção de bug
- [ ] refactor — sem mudança de comportamento
- [ ] test — testes
- [ ] docs — documentação
- [ ] chore — manutenção

## Como testar
1. [Passo a passo para validar a mudança]

## Checklist
- [ ] Testes unitários passando
- [ ] Testes E2E passando
- [ ] `tsc --noEmit` sem erros
- [ ] Sem `console.log` de debug
- [ ] Sem segredos ou dados sensíveis no código
- [ ] `.env.example` atualizado (se nova variável)
- [ ] Documentação atualizada (se mudança de contrato)

## Impacto em segurança
[Se não há impacto: "Nenhum". Se há, descrever.]
```
