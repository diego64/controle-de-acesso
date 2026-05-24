# Rule: Controller / Route Handler

## Responsabilidade
Controller é o adaptador entre HTTP e o service. Sem lógica de negócio aqui.

## Obrigatório

- Validar entrada via JSON Schema declarado na rota (Fastify nativo)
- Delegar toda lógica ao service — controller não toma decisão de negócio
- Retornar DTOs explícitos — nunca o retorno bruto do service sem verificar
- Capturar `AppError` e mapear para resposta HTTP com código correto
- Tipar `request.body`, `request.params`, `request.query` explicitamente

## Proibido

- Lógica de autenticação (hash, verify) dentro do controller
- Acesso direto ao Mongoose no controller
- `any` no tipo de request/reply
- Lógica condicional de negócio (`if user.role === 'admin'...`) — isso vai no service

## DTOs explícitos no response

```typescript
// Correto: DTO explícito
reply.status(201).send({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt
})

// Errado: retorno bruto pode expor passwordHash, __v, etc.
reply.status(201).send(user)
```

## Padrão de rota Fastify

```typescript
fastify.post<{ Body: RegisterBody }>(
  '/register',
  { schema: registerSchema },
  async (request, reply) => {
    const result = await registerUser(repo, request.body)
    return reply.status(201).send(result)
  }
)
```

## Tratamento de AppError no handler global

Registrar um `setErrorHandler` global no app — não try/catch em cada controller.
```typescript
fastify.setErrorHandler((error, _req, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message
    })
  }
  // erro inesperado
  reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Erro interno' })
})
```
