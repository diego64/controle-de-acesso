# Rule: Git

## Conventional Commits — em português

Formato: `tipo(escopo): descrição em minúsculas`

### Tipos permitidos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adição ou correção de testes |
| `docs` | Documentação |
| `chore` | Tarefas de manutenção (deps, config) |
| `perf` | Melhoria de performance |
| `ci` | Mudanças no pipeline CI/CD |

### Escopos válidos para esta API

`auth`, `user`, `jwt`, `redis`, `mongodb`, `config`, `infra`, `types`, `tests`

### Exemplos corretos

```
feat(auth): implementa endpoint de registro de usuário
fix(jwt): corrige geração de jti ausente no token
test(auth): adiciona testes e2e para rota de login
docs(security): documenta política de rate limiting
chore(deps): atualiza fastify para 4.28.0
refactor(repository): extrai interface UserRepository
```

### Exemplos incorretos

```
feat: adiciona coisa          # sem escopo
Fix: corrige bug              # maiúscula
feat(auth): Implementa Login  # maiúscula na descrição
update auth service           # sem tipo
```

## Regras de branch

| Branch | Propósito |
|---|---|
| `main` | Produção — protegida, merge via PR apenas |
| `develop` | Integração — merge de features |
| `feat/<escopo>/<descricao-curta>` | Features |
| `fix/<escopo>/<descricao-curta>` | Correções |

Exemplos: `feat/auth/registro-usuario`, `fix/jwt/jti-ausente`

## Proibido

- `git push --force` em `main` e `develop` — sem exceções
- Commit com `passwordHash`, tokens ou secrets reais — usar `git-secrets` ou equivalente
- Commits com `console.log` de debug
- Mensagens genéricas: `fix`, `update`, `wip`, `teste`
- Commitar `.env`, `.env.test`, `.env.local`

## .gitignore mínimo

```
.env
.env.local
.env.test
.env.*.local
CLAUDE.local.md
.claude/settings.local.json
node_modules/
dist/
coverage/
```
