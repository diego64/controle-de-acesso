import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ioredis', async () => {
  const mod = await import('ioredis-mock')
  return { Redis: mod.default, default: mod.default }
})

import type { FastifyInstance } from 'fastify'
import { buildApp } from '@/app.js'
import { UserModel } from '@/models/user.model.js'

async function registerAndLogin(
  app: FastifyInstance,
  overrides: Partial<{ email: string; password: string; firstName: string; lastName: string }> = {},
): Promise<string> {
  const payload = {
    email: overrides.email ?? 'usuario@test.com',
    password: overrides.password ?? 'senha-segura-123',
    firstName: overrides.firstName ?? 'João',
    lastName: overrides.lastName ?? 'Silva',
  }
  await app.inject({ method: 'POST', url: '/auth/register', payload })
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: payload.email, password: payload.password },
  })
  return (JSON.parse(login.body) as { accessToken: string }).accessToken
}

async function promoteToAdmin(email: string): Promise<void> {
  await UserModel.updateOne({ email }, { $set: { role: 'ADMINISTRADOR' } })
}

describe('Users E2E — GET /users (admin-only)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ testing: true })
    await app.ready()
  })

  beforeEach(async () => {
    await UserModel.deleteMany({})
    await app.redis.flushall()
  })

  afterAll(async () => {
    await app.close()
  })

  it('401 TOKEN_MISSING - sem header Authorization', async () => {
    // Act
    const response = await app.inject({ method: 'GET', url: '/users/' })

    // Assert
    expect(response.statusCode).toBe(401)
    const body = JSON.parse(response.body) as { error: string }
    expect(body.error).toBe('TOKEN_MISSING')
  })

  it('403 FORBIDDEN - usuário com role USUARIO não pode listar', async () => {
    // Arrange — registra como USUARIO (default)
    const token = await registerAndLogin(app, { email: 'comum@test.com' })

    // Act
    const response = await app.inject({
      method: 'GET',
      url: '/users/',
      headers: { authorization: `Bearer ${token}` },
    })

    // Assert
    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body) as { error: string }
    expect(body.error).toBe('FORBIDDEN')
  })

  it('200 - ADMINISTRADOR lista todos os usuários', async () => {
    // Arrange — cria 3 usuários, promove 1 a ADMIN
    await registerAndLogin(app, { email: 'a@test.com', firstName: 'Ana', lastName: 'A' })
    await registerAndLogin(app, { email: 'b@test.com', firstName: 'Bruno', lastName: 'B' })
    const adminToken = await registerAndLogin(app, {
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'Master',
    })
    await promoteToAdmin('admin@test.com')

    // Act
    const response = await app.inject({
      method: 'GET',
      url: '/users/',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    // Assert
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body) as Array<{
      id: string
      email: string
      firstName: string
      lastName: string
      role: string
      passwordHash?: string
    }>
    expect(body).toHaveLength(3)
    // Não vaza passwordHash em nenhum item
    body.forEach((u) => expect(u.passwordHash).toBeUndefined())
    // Pelo menos um é ADMINISTRADOR
    expect(body.some((u) => u.role === 'ADMINISTRADOR')).toBe(true)
    // Os emails registrados estão presentes
    const emails = body.map((u) => u.email).sort()
    expect(emails).toEqual(['a@test.com', 'admin@test.com', 'b@test.com'])
  })

  it('401 TOKEN_REVOKED - admin foi removido do DB entre login e request', async () => {
    // Arrange
    const token = await registerAndLogin(app, { email: 'admin@test.com' })
    await promoteToAdmin('admin@test.com')
    // Simula remoção externa
    await UserModel.deleteOne({ email: 'admin@test.com' })

    // Act
    const response = await app.inject({
      method: 'GET',
      url: '/users/',
      headers: { authorization: `Bearer ${token}` },
    })

    // Assert
    expect(response.statusCode).toBe(401)
    const body = JSON.parse(response.body) as { error: string }
    expect(body.error).toBe('TOKEN_REVOKED')
  })
})
