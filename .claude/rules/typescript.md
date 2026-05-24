# Rule: TypeScript

## Configuração base (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] },
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Obrigatório

- **Named exports** em todos os módulos — sem `export default` em módulos internos
- **Tipos explícitos** em parâmetros de função e retornos públicos
- **Tipos inferidos do Zod** via `z.infer<>` — nunca redeclara o que Zod já define
- **Augmentação de tipos Fastify** em `src/types/fastify.d.ts` para `request.user`

## Proibido

- `any` sem comentário `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + justificativa
- `as` cast sem verificação prévia (type narrowing deve ser feito com `if` ou `instanceof`)
- `!` non-null assertion sem comentário explicando por que é seguro
- `export default` em módulos internos — dificulta refactor e auto-import

## Augmentação de tipos Fastify

```typescript
// src/types/fastify.d.ts
import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      email: string
      jti: string
    }
    user: {
      id: string
      email: string
      jti: string
    }
  }
}
```

## Padrão de named exports

```typescript
// Correto
export function hashPassword(plain: string): string { ... }
export type { UserDTO }

// Errado
export default function hashPassword(...) { ... }
```
