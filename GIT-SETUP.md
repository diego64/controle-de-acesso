# Git Setup — Passo a Passo

Execute estes comandos UMA VEZ após clonar o repositório.

## 1. Instalar dependências

```bash
pnpm install
```

## 2. Ativar Husky (hooks locais)

```bash
pnpm prepare
# Isso roda: husky
# Resultado: .husky/commit-msg e .husky/pre-commit ficam ativos
```

## 3. Verificar que os hooks estão funcionando

```bash
# Testar commit inválido — deve falhar
git commit --allow-empty -m "update auth service"
# Esperado: ERRO — falta tipo e escopo

# Testar commit válido — deve passar
git commit --allow-empty -m "chore(config): configura commitlint e husky"
# Esperado: sucesso
```

## 4. Configurar branch protection no GitHub

Acesse: Settings → Branches → Add rule para `main` e `develop`

Configurações recomendadas para `main`:
- [x] Require a pull request before merging
- [x] Require approvals: 1
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - Adicionar: `Lint & Type Check`, `Unit Tests`, `E2E Tests`, `Build`, `Validate Commit Messages`
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

Configurações recomendadas para `develop`:
- [x] Require a pull request before merging
- [x] Require status checks to pass before merging
  - Adicionar os mesmos checks do main
- [ ] Require approvals (opcional para develop)

## 5. Configurar CODEOWNERS

Editar `.github/CODEOWNERS` e substituir `@seu-usuario` pelo seu GitHub username.

## 6. Adicionar secrets no GitHub

Acesse: Settings → Secrets and variables → Actions

Não há secrets obrigatórios para o CI funcionar — as variáveis de teste
estão hardcoded no workflow `ci.yml` com valores seguros para teste.

Para deploy na Vercel, os secrets são gerenciados pelo Vercel diretamente.

## O que cada hook faz

### pre-commit
Executa antes de cada `git commit`:
1. `lint-staged` — ESLint + Prettier apenas nos arquivos staged
2. `tsc --noEmit` — type-check em todo o projeto

Se qualquer um falhar, o commit é bloqueado.

### commit-msg
Valida a mensagem do commit contra as regras do `.commitlintrc.json`:
- Formato: `tipo(escopo): descrição em minúsculas`
- Tipos válidos: feat, fix, refactor, test, docs, chore, perf, ci
- Escopos válidos: auth, user, jwt, redis, mongodb, config, infra, types, tests

## Fluxo normal de trabalho

```bash
# 1. Criar branch a partir de develop
git checkout develop
git pull origin develop
git checkout -b feat/auth/logout

# 2. Desenvolver + commitar
git add src/modules/auth/auth.service.ts
git commit -m "feat(auth): implementa logout com invalidação redis"
# hook pre-commit: lint-staged + type-check
# hook commit-msg: valida formato

# 3. Abrir PR para develop
# Template de PR é preenchido automaticamente pelo GitHub

# 4. CI roda automaticamente:
#    - Lint & Type Check
#    - Unit Tests
#    - E2E Tests (com MongoDB + Redis via services)
#    - Build
#    - Commitlint (valida todos os commits do PR)
#    - Security (audit + gitleaks)
```
