# Rule: Repository

## Responsabilidade
Abstração de acesso ao banco. Isola Mongoose do resto da aplicação.

## Obrigatório

- Retornar tipos de domínio puros (não `Document` do Mongoose)
- Usar `.lean()` nas queries de leitura — retorna POJO, não Document
- Expor interface TypeScript do repository — service depende da interface, não da implementação
- Tratar erros do MongoDB e relançar como `AppError` quando necessário

## Proibido

- Lógica de negócio dentro do repository (validações, regras)
- Retornar `passwordHash` em métodos que não sejam `findByEmailWithPassword`
- Queries N+1 — usar projeções adequadas

## Padrão de interface

```typescript
export interface UserRepository {
  findByEmail(email: string): Promise<UserDTO | null>
  findByEmailWithPassword(email: string): Promise<UserWithHashDTO | null>
  findById(id: string): Promise<UserDTO | null>
  create(data: CreateUserInput): Promise<UserDTO>
}
```

## Padrão de implementação

```typescript
export class MongoUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserDTO | null> {
    const doc = await UserModel.findOne({ email }).lean()
    if (!doc) return null
    return { id: doc._id.toString(), email: doc.email, createdAt: doc.createdAt }
  }

  async findByEmailWithPassword(email: string): Promise<UserWithHashDTO | null> {
    // select('+passwordHash') necessário pois campo tem select: false
    const doc = await UserModel.findOne({ email }).select('+passwordHash').lean()
    if (!doc) return null
    return {
      id: doc._id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt
    }
  }
}
```

## Tratamento de erro de duplicidade

```typescript
async create(data: CreateUserInput): Promise<UserDTO> {
  try {
    const doc = await UserModel.create(data)
    return { id: doc._id.toString(), email: doc.email, createdAt: doc.createdAt }
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as any).code === 11000) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 409)
    }
    throw err
  }
}
```
