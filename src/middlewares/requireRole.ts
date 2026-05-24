import type { FastifyReply, FastifyRequest } from 'fastify'
import type { UserRole } from '@/models/user.model.js'
import type { UserRepository } from '@/modules/user/user.repository.js'
import { AppError } from '@/shared/errors/AppError.js'

export type RoleGuard = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>

export type RoleGuardFactory = (...allowedRoles: UserRole[]) => RoleGuard

// Lookup ao DB (em vez de checar role do JWT) garante que promoção/rebaixamento
// tem efeito imediato — usuário não precisa relogar para perder/ganhar acesso.
// Custo: 1 query extra por request guardado. Aceitável para rotas admin.
export function createRequireRole(repo: UserRepository): RoleGuardFactory {
  return (...allowedRoles: UserRole[]): RoleGuard => {
    return async (request, _reply) => {
      const user = await repo.findById(request.user.id)
      if (!user) {
        throw new AppError('TOKEN_REVOKED', 401)
      }
      if (!allowedRoles.includes(user.role)) {
        throw new AppError('FORBIDDEN', 403)
      }
    }
  }
}
