# Command: /changelog

Gera o CHANGELOG da versão atual com base nos commits desde a última tag.

## Como usar

Executar `/changelog` com o range de commits desejado.
Exemplo: "gere changelog do v1.0.0 até agora"

## Output esperado (formato Keep a Changelog)

```markdown
## [1.1.0] - YYYY-MM-DD

### Adicionado
- feat(auth): endpoint de logout com invalidação Redis (#PR)
- feat(health): endpoint /health/ready com check de MongoDB e Redis (#PR)

### Corrigido
- fix(jwt): geração de jti ausente no token de acesso (#PR)
- fix(repository): vazamento de passwordHash em findByEmail (#PR)

### Alterado
- refactor(service): extrai lógica de hash para shared/crypto.ts (#PR)

### Segurança
- chore(deps): atualiza @fastify/jwt para corrigir CVE-XXXX (#PR)
```
