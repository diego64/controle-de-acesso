# Rule: Testing

## Pirâmide de testes

```
         E2E (Vitest + fastify.inject)
        ──────────────────────────────
         Integration (Vitest + MongoDB in-memory + Redis mock)
        ──────────────────────────────────────────────────────
         Unit (Vitest puro — sem I/O, sem framework)
        ──────────────────────────────────────────────────────
```

## Padrão AAA — obrigatório em todos os testes

```typescript
it('deve retornar 409 quando email já existe', async () => {
  // Arrange
  await createUser({ email: 'test@test.com' })

  // Act
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: 'test@test.com', password: 'Senha123!' }
  })

  // Assert
  expect(response.statusCode).toBe(409)
  expect(JSON.parse(response.body).error).toBe('EMAIL_ALREADY_EXISTS')
})
```

## Testes unitários

- **Sem banco real** — service testado com repository mockado via `vi.fn()`
- **Sem Fastify** — service recebe dependências por parâmetro, testável diretamente
- **Cobertura mínima:** funções de crypto, service (happy path + edge cases críticos)

```typescript
// tests/unit/auth.service.test.ts
it('deve lançar AppError EMAIL_ALREADY_EXISTS se email duplicado', async () => {
  const mockRepo = {
    findByEmail: vi.fn().mockResolvedValue({ id: '1', email: 'x@x.com' }),
    create: vi.fn(),
    // ...
  }

  await expect(
    registerUser(mockRepo, { email: 'x@x.com', password: 'Senha123!' })
  ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 })
})
```

## Testes E2E

- **MongoDB in-memory** via `mongodb-memory-server`
- **Redis mock** via `ioredis-mock` ou instância Docker dedicada
- **Nunca** atingir MongoDB Atlas ou Upstash em testes
- **`beforeEach`**: limpar collections — nunca assumir estado anterior
- **`await app.ready()`** obrigatório antes do primeiro `inject()`
- **`afterAll`**: fechar app + desconectar banco

```typescript
// tests/e2e/register.test.ts
describe('POST /auth/register', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ testing: true })
    await app.ready()
  })

  beforeEach(async () => {
    await UserModel.deleteMany({})
  })

  afterAll(async () => {
    await app.close()
  })

  it('201 - registro bem-sucedido', async () => { ... })
  it('409 - email duplicado', async () => { ... })
  it('422 - payload inválido', async () => { ... })
})
```

## Testes de carga (k6)

```javascript
// tests/load/login.k6.js
export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
}
```

Executar apenas contra ambiente local com Docker. **Nunca rodar k6 contra produção.**

## vitest.config.ts

```typescript
export default defineConfig({
  test: {
    projects: [
      { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
      {
        name: 'e2e',
        include: ['tests/e2e/**/*.test.ts'],
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
      },
    ],
  },
})
```
