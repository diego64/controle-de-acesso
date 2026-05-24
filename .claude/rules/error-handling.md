# Rule: Error Handling

## Hierarquia de erros

```
Error (nativo)
└── AppError (domínio)
    ├── ValidationError    (422)
    ├── AuthError          (401 / 403)
    ├── ConflictError      (409)
    └── NotFoundError      (404)
```

## AppError

```typescript
// src/shared/errors/AppError.ts

export class AppError extends Error {
  constructor(
    public readonly code: string,       // Ex: 'EMAIL_ALREADY_EXISTS'
    public readonly statusCode: number, // HTTP status
    message?: string
  ) {
    super(message ?? code)
    this.name = 'AppError'
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
```

## Obrigatório

- Todo erro de negócio → `throw new AppError('CODIGO', statusCode)`
- `setErrorHandler` global no Fastify para capturar e formatar todos os erros
- Erros inesperados (não AppError) → logar com stack trace + retornar 500 genérico
- Nunca expor stack trace em resposta de produção

## Proibido

- `throw new Error('email já existe')` — string sem código é inrastreável
- try/catch individual em cada controller — usar o handler global
- Retornar mensagens diferentes para "email não encontrado" vs "senha errada" — enumeração de usuários
- Logar senha ou token em mensagens de erro

## Códigos de erro padronizados

| Código | Status | Descrição |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | 409 | Email já cadastrado |
| `INVALID_CREDENTIALS` | 401 | Login inválido (genérico) |
| `TOKEN_MISSING` | 401 | Authorization header ausente |
| `TOKEN_INVALID` | 401 | JWT malformado ou assinatura inválida |
| `TOKEN_EXPIRED` | 403 | JWT expirado |
| `TOKEN_REVOKED` | 401 | JWT na blocklist Redis |
| `VALIDATION_ERROR` | 422 | Payload inválido (Fastify JSON Schema) |
| `RATE_LIMIT_EXCEEDED` | 429 | Muitas requisições |
| `FORBIDDEN` | 403 | Token válido, porém role insuficiente para a operação |
| `INTERNAL_ERROR` | 500 | Erro não tratado |

## Formato de response de erro (RFC 7807)

```json
{
  "statusCode": 409,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "Este email já está em uso"
}
```
