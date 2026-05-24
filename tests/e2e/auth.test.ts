import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock ioredis com ioredis-mock — hoisted ao topo do arquivo pelo Vitest,
// então imports subsequentes resolvem para a versão in-memory.
vi.mock('ioredis', async () => {
  const mod = await import('ioredis-mock')
  return { Redis: mod.default, default: mod.default }
})

import type { FastifyInstance } from 'fastify'
import { buildApp } from '@/app.js'
import { UserModel } from '@/models/user.model.js'

const VALID_USER = {
  email: 'user@test.com',
  password: 'senha-segura-123',
  firstName: 'João',
  lastName: 'Silva',
}

async function registerUser(app: FastifyInstance, payload = VALID_USER) {
  return app.inject({
    method: 'POST',
    url: '/auth/register',
    payload,
  })
}

async function loginUser(
  app: FastifyInstance,
  payload: { email: string; password: string } = {
    email: VALID_USER.email,
    password: VALID_USER.password,
  },
) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload,
  })
}

describe('Auth E2E', () => {
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

  describe('POST /auth/register', () => {
    it('201 - registra usuário e retorna DTO com nome/sobrenome/role (sem passwordHash)', async () => {
      // Arrange / Act
      const response = await registerUser(app)

      // Assert
      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body) as Record<string, unknown>
      expect(body.email).toBe(VALID_USER.email)
      expect(body.firstName).toBe(VALID_USER.firstName)
      expect(body.lastName).toBe(VALID_USER.lastName)
      expect(body.role).toBe('USUARIO')
      expect(body.id).toBeTypeOf('string')
      expect(body.createdAt).toBeTypeOf('string')
      expect(body.passwordHash).toBeUndefined()
      expect(body.password).toBeUndefined()
    })

    it('422 - faltando firstName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'x@x.com',
          password: 'senha-segura-123',
          lastName: 'Silva',
        },
      })
      expect(response.statusCode).toBe(422)
    })

    it('201 - persiste email lowercased no banco', async () => {
      // Arrange
      const mixedCase = { ...VALID_USER, email: 'User@Example.COM' }

      // Act
      const response = await registerUser(app, mixedCase)

      // Assert
      expect(response.statusCode).toBe(201)
      const stored = await UserModel.findOne({ email: 'user@example.com' }).lean()
      expect(stored).not.toBeNull()
    })

    it('409 - email duplicado retorna EMAIL_ALREADY_EXISTS', async () => {
      // Arrange
      await registerUser(app)

      // Act
      const response = await registerUser(app)

      // Assert
      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('422 - email malformado', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'nao-eh-email',
          password: 'senha-segura-123',
          firstName: 'X',
          lastName: 'Y',
        },
      })

      // Assert
      expect(response.statusCode).toBe(422)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('VALIDATION_ERROR')
    })

    it('422 - senha curta demais', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'x@x.com',
          password: '123',
          firstName: 'X',
          lastName: 'Y',
        },
      })

      // Assert
      expect(response.statusCode).toBe(422)
    })

    it('422 - rejeita campos extras (additionalProperties: false)', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { ...VALID_USER, role: 'admin' },
      })

      // Assert
      expect(response.statusCode).toBe(422)
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await registerUser(app)
    })

    it('200 - login bem-sucedido retorna accessToken e expiresIn', async () => {
      // Act
      const response = await loginUser(app)

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body) as Record<string, unknown>
      expect(body.accessToken).toBeTypeOf('string')
      expect((body.accessToken as string).split('.')).toHaveLength(3) // JWT header.payload.signature
      expect(body.expiresIn).toBe('15m')
    })

    it('200 - aceita email em case diferente do cadastrado', async () => {
      // Act
      const response = await loginUser(app, {
        email: 'USER@TEST.COM',
        password: VALID_USER.password,
      })

      // Assert
      expect(response.statusCode).toBe(200)
    })

    it('401 - senha errada retorna INVALID_CREDENTIALS', async () => {
      // Act
      const response = await loginUser(app, {
        email: VALID_USER.email,
        password: 'senha-errada-1234',
      })

      // Assert
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('INVALID_CREDENTIALS')
    })

    it('401 - usuário inexistente retorna INVALID_CREDENTIALS', async () => {
      // Act
      const response = await loginUser(app, {
        email: 'naoexiste@test.com',
        password: 'qualquer-senha-aqui',
      })

      // Assert
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('INVALID_CREDENTIALS')
    })

    it('401 - mesma resposta para senha errada vs usuário inexistente (anti-enumeração)', async () => {
      // Act
      const wrongPass = await loginUser(app, {
        email: VALID_USER.email,
        password: 'senha-errada-1234',
      })
      const noUser = await loginUser(app, {
        email: 'naoexiste@test.com',
        password: 'qualquer-senha-aqui',
      })

      // Assert
      expect(wrongPass.statusCode).toBe(noUser.statusCode)
      expect(JSON.parse(wrongPass.body)).toEqual(JSON.parse(noUser.body))
    })
  })

  describe('GET /auth/me (rota protegida)', () => {
    let accessToken: string

    beforeEach(async () => {
      await registerUser(app)
      const login = await loginUser(app)
      accessToken = (JSON.parse(login.body) as { accessToken: string }).accessToken
    })

    it('200 - retorna dados do usuário autenticado (com nome/sobrenome/role)', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body) as Record<string, unknown>
      expect(body.email).toBe(VALID_USER.email)
      expect(body.firstName).toBe(VALID_USER.firstName)
      expect(body.lastName).toBe(VALID_USER.lastName)
      expect(body.role).toBe('USUARIO')
      expect(body.id).toBeTypeOf('string')
      expect(body.createdAt).toBeTypeOf('string')
      expect(body.passwordHash).toBeUndefined()
    })

    it('401 TOKEN_MISSING - sem header Authorization', async () => {
      // Act
      const response = await app.inject({ method: 'GET', url: '/auth/me' })

      // Assert
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('TOKEN_MISSING')
    })

    it('401 TOKEN_INVALID - token malformado', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'Bearer xyz.malformado.aqui' },
      })

      // Assert
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('TOKEN_INVALID')
    })

    it('401 TOKEN_INVALID - token assinado com outro secret', async () => {
      // Arrange — JWT manualmente assinado com secret inválido
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4IiwiaWF0IjoxNzAwMDAwMDAwfQ.invalidSig'

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${fakeToken}` },
      })

      // Assert
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /auth/logout', () => {
    let accessToken: string

    beforeEach(async () => {
      await registerUser(app)
      const login = await loginUser(app)
      accessToken = (JSON.parse(login.body) as { accessToken: string }).accessToken
    })

    it('204 - revoga o token (round trip: /me ok → logout → /me TOKEN_REVOKED)', async () => {
      // Arrange — confirma que o token funciona antes do logout
      const beforeLogout = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(beforeLogout.statusCode).toBe(200)

      // Act
      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      // Assert — logout aceito sem body
      expect(logout.statusCode).toBe(204)
      expect(logout.body).toBe('')

      // Assert — o mesmo token agora está bloqueado
      const afterLogout = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(afterLogout.statusCode).toBe(401)
      const body = JSON.parse(afterLogout.body) as { error: string }
      expect(body.error).toBe('TOKEN_REVOKED')
    })

    it('401 TOKEN_MISSING - sem header Authorization', async () => {
      // Act
      const response = await app.inject({ method: 'POST', url: '/auth/logout' })

      // Assert
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('TOKEN_MISSING')
    })

    it('401 TOKEN_INVALID - token malformado', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: 'Bearer xxx.invalid.aqui' },
      })

      // Assert
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body) as { error: string }
      expect(body.error).toBe('TOKEN_INVALID')
    })
  })
})
