---
name: changelog
description: Gera o CHANGELOG da versão atual com base nos commits. Invocar apenas na hora de release.
disable-model-invocation: true
---

Gerar CHANGELOG no formato Keep a Changelog com base nos commits desde a última tag.

Formato obrigatório:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Adicionado
- feat(escopo): descrição (#PR)

### Corrigido
- fix(escopo): descrição (#PR)

### Alterado
- refactor(escopo): descrição (#PR)

### Segurança
- chore(deps): descrição de CVE corrigido (#PR)
```

Regras:
- Agrupar por tipo seguindo conventional commits
- Incluir referência do PR entre parênteses quando disponível
- Ignorar commits `chore` que não sejam relevantes para o usuário final
- Destacar breaking changes no topo da versão com `⚠️ BREAKING`
