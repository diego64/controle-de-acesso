# Database — controle-de-acesso

## Stack de banco

- **Local:** MongoDB 7 via Docker
- **Produção:** MongoDB Atlas (M0 free tier / M10 para produção real)
- **ODM:** Mongoose 8.x

## Mongoose Schema: User

```typescript
// src/models/user.model.ts

import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  email: string
  passwordHash: string  // formato: "hash:salt" (ambos hex)
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,  // nunca retornar em queries padrão
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.passwordHash  // garantia extra
        delete ret.__v
        return ret
      },
    },
  }
)
```

## Decisões de modelagem

### passwordHash como "hash:salt"
- Salt e hash armazenados juntos separados por `:` em campo único.
- Facilita portabilidade e evita dois campos separados.
- Campo marcado com `select: false` — nunca retornado em `.find()` padrão.
- Para verificar senha: `User.findById(id).select('+passwordHash')`.

### email com index único
- Index declarado no schema (não na migration) — Mongoose garante `createIndex` no connect.
- `lowercase: true` e `trim: true` no schema para normalização automática.

### Sem softDelete nesta API
- Escopo simples: sem `deletedAt`. Se necessário no futuro, adicionar ADR.

## Conexão

```typescript
// src/plugins/mongodb.ts
// mongoose.connect() com cache de conexão para Vercel Serverless

let cached: typeof mongoose | null = null

export async function connectMongoDB(uri: string) {
  if (cached) return cached
  cached = await mongoose.connect(uri, {
    bufferCommands: true,  // necessário para cold start Vercel
    maxPoolSize: 10,
  })
  return cached
}
```

**Por que cache?** Vercel reutiliza o processo Node entre invocações na mesma instância.
Sem cache, cada request abre uma nova conexão e esgota o pool do Atlas.

## Redis: estrutura de chaves

| Chave | Valor | TTL | Uso |
|---|---|---|---|
| `blocklist:<jti>` | `"1"` | Tempo restante do token | JWT revogado no logout |
| `rate:<ip>:<route>` | contador | Janela de rate limit | Proteção contra brute force |

## Índices recomendados para Atlas

```javascript
// Na collection users
db.users.createIndex({ email: 1 }, { unique: true })
```
