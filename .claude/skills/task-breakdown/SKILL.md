---
name: task-breakdown
description: Quebra uma feature ou requisito em tarefas granulares e ordenadas. Invocar antes de implementar qualquer feature nova.
disable-model-invocation: false
---

Dado o requisito informado, gerar uma lista de tarefas na seguinte estrutura:

```
FEATURE: <nome>

DEPENDÊNCIAS NECESSÁRIAS:
- <o que precisa existir antes>

TAREFAS (em ordem de execução):

[ ] 1. <título>
       Arquivo: <caminho>
       Lógica: <o que implementar>
       Critério: <como saber que está pronto>

[ ] 2. ...

ESTIMATIVA: <tempo>
RISCO: <o que pode dar errado>
```

Regras:
- Sempre verificar se a tarefa viola alguma rule de `.claude/rules/`
- Sempre verificar se a tarefa precisa de ADR em `docs/architecture.md`
- Nunca propor dependências novas sem marcar como `[PROPOSTA]`
- Tarefas devem ser pequenas o suficiente para um commit cada
