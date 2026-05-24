# Rule: Service

## Responsabilidade
O service contém **toda a lógica de negócio**. Não conhece HTTP, Fastify, request ou response.

## Obrigatório

- Receber dependências por parâmetro (injeção explícita) — sem imports diretos de DB no service
- Retornar objetos de domínio puros — nunca documentos Mongoose diretamente
- Lançar `AppError` para erros de negócio — nunca `throw new Error('string')`
- Ser completamente testável com Vitest sem qualquer mock de framework

## Proibido

- `import { FastifyRequest, FastifyReply }` dentro de um service
- Acessar `process.env` diretamente — receber config por parâmetro ou via `env.ts`
- Retornar documentos Mongoose com `__v` ou `passwordHash` expostos
- Lógica HTTP (status codes, headers) — isso é responsabilidade do controller

## Padrão de assinatura

```typescript
// Correto
export async function loginUser(
  repo: UserRepository,
  redis: RedisClient,
  input: LoginInput
): Promise<LoginOutput>

// Errado
export async function loginUser(request: FastifyRequest): Promise<FastifyReply>
```

## Exemplo de estrutura

```typescript
export async function registerUser(
  repo: UserRepository,
  input: RegisterInput
): Promise<RegisterOutput> {
  const exists = await repo.findByEmail(input.email)
  if (exists) throw new AppError('EMAIL_ALREADY_EXISTS', 409)

  const passwordHash = hashPassword(input.password)
  const user = await repo.create({ email: input.email, passwordHash })

  return { id: user.id, email: user.email, createdAt: user.createdAt }
}
```
