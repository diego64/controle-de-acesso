## O que foi feito

<!-- Descrição objetiva em 2-4 linhas. O quê mudou e por quê. -->

## Tipo de mudança

- [ ] `feat` — nova funcionalidade
- [ ] `fix` — correção de bug
- [ ] `refactor` — sem mudança de comportamento
- [ ] `test` — testes adicionados ou corrigidos
- [ ] `docs` — documentação
- [ ] `chore` — deps, config, manutenção
- [ ] `perf` — melhoria de performance
- [ ] `ci` — pipeline / workflows

## Escopo afetado

- [ ] `auth` — registro, login, logout
- [ ] `user` — model, repository
- [ ] `jwt` — geração, verificação, blocklist
- [ ] `redis` — conexão, cache, blocklist
- [ ] `mongodb` — conexão, schemas, queries
- [ ] `config` — env, constantes
- [ ] `infra` — Docker, Grafana, Prometheus
- [ ] `types` — TypeScript, augmentações
- [ ] `tests` — unit, e2e, load

## Como testar

<!-- Passo a passo para validar a mudança localmente -->

1.
2.
3.

## Checklist — obrigatório antes de solicitar review

### Qualidade
- [ ] `pnpm type-check` sem erros
- [ ] `pnpm lint` sem erros
- [ ] `pnpm test` passando (unit + e2e)
- [ ] Sem `console.log` de debug no código

### Testes
- [ ] Happy path coberto
- [ ] Edge cases críticos cobertos
- [ ] `beforeEach` limpa o estado nos testes E2E

### Segurança
- [ ] Sem secrets, tokens ou senhas hardcoded
- [ ] `passwordHash` não aparece em nenhum response
- [ ] Novos endpoints protegidos têm hook de autenticação
- [ ] Rate limit aplicado se endpoint de auth
- [ ] `jti` presente em JWTs emitidos

### Documentação
- [ ] `.env.example` atualizado (se nova variável de ambiente)
- [ ] Contrato de API atualizado em `docs/architecture.md` (se nova rota)
- [ ] `docs/security.md` atualizado (se mudança de fluxo de auth)
- [ ] ADR criado em `docs/architecture.md` (se decisão arquitetural)

## Impacto em segurança

<!-- Se não há impacto: "Nenhum." -->
<!-- Se há: descrever o que muda e como foi mitigado. -->

## Screenshots / evidência (opcional)

<!-- Output de testes, curl, logs — útil para mudanças de comportamento -->
