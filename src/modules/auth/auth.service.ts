import { randomUUID } from 'node:crypto'
import { env } from '@/config/env.js'
import type { UserRepository } from '@/modules/user/user.repository.js'
import { hashPassword, verifyPassword } from '@/shared/crypto.js'
import { AppError } from '@/shared/errors/AppError.js'
import type { Blocklist } from './blocklist.js'
import type {
  LoginInput,
  LoginOutput,
  LogoutInput,
  RegisterInput,
  RegisterOutput,
  SignToken,
} from './auth.types.js'

// Hash pré-computado usado como fallback quando o e-mail não existe.
// Garante que `verifyPassword` sempre roda — sem isso, o caminho `!user`
// retorna em ~0ms enquanto o caminho de senha errada gasta ~100ms,
// permitindo enumeração de usuários por timing (canal lateral).
// Computado uma única vez no module-load.
const DUMMY_PASSWORD_HASH = hashPassword(
  'timing-defense-placeholder-never-a-valid-password',
)

export async function registerUser(
  repo: UserRepository,
  input: RegisterInput,
): Promise<RegisterOutput> {
  const exists = await repo.findByEmail(input.email)
  if (exists) {
    throw new AppError('EMAIL_ALREADY_EXISTS', 409)
  }

  const passwordHash = hashPassword(input.password)
  const user = await repo.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
  })

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    createdAt: user.createdAt,
  }
}

export async function loginUser(
  repo: UserRepository,
  sign: SignToken,
  input: LoginInput,
): Promise<LoginOutput> {
  const user = await repo.findByEmailWithPassword(input.email)
  const hashToVerify = user?.passwordHash ?? DUMMY_PASSWORD_HASH
  const passwordValid = verifyPassword(input.password, hashToVerify)

  if (!user || !passwordValid) {
    throw new AppError('INVALID_CREDENTIALS', 401)
  }

  const accessToken = sign({
    sub: user.id,
    email: user.email,
    jti: randomUUID(),
  })

  return {
    accessToken,
    expiresIn: env.JWT_EXPIRES_IN,
  }
}

export async function logoutUser(
  blocklist: Blocklist,
  input: LogoutInput,
): Promise<void> {
  const ttl = input.exp - Math.floor(Date.now() / 1000)
  await blocklist.add(input.jti, ttl)
}
