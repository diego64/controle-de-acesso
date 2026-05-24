import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest'
import {
  loginUser,
  logoutUser,
  registerUser,
} from '@/modules/auth/auth.service.js'
import type { Blocklist } from '@/modules/auth/blocklist.js'
import type { SignToken } from '@/modules/auth/auth.types.js'
import type { UserRepository } from '@/modules/user/user.repository.js'
import type { UserDTO, UserWithHashDTO } from '@/modules/user/user.types.js'
import { hashPassword } from '@/shared/crypto.js'

function buildRepo(): Mocked<UserRepository> {
  return {
    findByEmail: vi.fn(),
    findByEmailWithPassword: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
  } as Mocked<UserRepository>
}

function buildBlocklist(): Mocked<Blocklist> {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
  } as Mocked<Blocklist>
}

function buildUserDTO(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: 'user-123',
    email: 'user@test.com',
    firstName: 'João',
    lastName: 'Silva',
    role: 'USUARIO',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function buildUserWithHash(
  passwordHash: string,
  overrides: Partial<UserWithHashDTO> = {},
): UserWithHashDTO {
  return {
    ...buildUserDTO(),
    passwordHash,
    ...overrides,
  }
}

describe('AuthService.registerUser', () => {
  let repo: Mocked<UserRepository>

  beforeEach(() => {
    repo = buildRepo()
  })

  it('cria usuário e retorna DTO com firstName/lastName/role (sem passwordHash)', async () => {
    // Arrange
    repo.findByEmail.mockResolvedValue(null)
    repo.create.mockResolvedValue(buildUserDTO())

    // Act
    const result = await registerUser(repo, {
      email: 'user@test.com',
      password: 'senha-segura',
      firstName: 'João',
      lastName: 'Silva',
    })

    // Assert
    expect(result).toEqual({
      id: 'user-123',
      email: 'user@test.com',
      firstName: 'João',
      lastName: 'Silva',
      role: 'USUARIO',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    expect('passwordHash' in result).toBe(false)
    expect(repo.findByEmail).toHaveBeenCalledWith('user@test.com')
    expect(repo.create).toHaveBeenCalledOnce()
  })

  it('passa firstName/lastName ao repo.create (junto com passwordHash hashed)', async () => {
    // Arrange
    repo.findByEmail.mockResolvedValue(null)
    repo.create.mockResolvedValue(buildUserDTO())

    // Act
    await registerUser(repo, {
      email: 'x@x.com',
      password: 'plain',
      firstName: 'Ana',
      lastName: 'Costa',
    })

    // Assert
    const createArg = repo.create.mock.calls[0]?.[0]
    expect(createArg?.email).toBe('x@x.com')
    expect(createArg?.firstName).toBe('Ana')
    expect(createArg?.lastName).toBe('Costa')
    expect(createArg?.passwordHash).not.toBe('plain')
    expect(createArg?.passwordHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/)
  })

  it('lança AppError EMAIL_ALREADY_EXISTS quando email já existe', async () => {
    // Arrange
    repo.findByEmail.mockResolvedValue(buildUserDTO({ email: 'existe@test.com' }))

    // Act / Assert
    await expect(
      registerUser(repo, {
        email: 'existe@test.com',
        password: 'qualquer',
        firstName: 'X',
        lastName: 'Y',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 })

    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('AuthService.loginUser', () => {
  let repo: Mocked<UserRepository>
  let sign: ReturnType<typeof vi.fn>

  beforeEach(() => {
    repo = buildRepo()
    sign = vi.fn().mockReturnValue('fake-jwt-token')
  })

  it('retorna accessToken e expiresIn quando credenciais corretas', async () => {
    // Arrange
    const passwordHash = hashPassword('senha-correta')
    repo.findByEmailWithPassword.mockResolvedValue(
      buildUserWithHash(passwordHash, { id: 'user-1' }),
    )

    // Act
    const result = await loginUser(repo, sign as unknown as SignToken, {
      email: 'user@test.com',
      password: 'senha-correta',
    })

    // Assert
    expect(result.accessToken).toBe('fake-jwt-token')
    expect(result.expiresIn).toBe('15m')
    expect(sign).toHaveBeenCalledOnce()
  })

  it('chama sign com payload contendo sub, email e jti em formato UUID', async () => {
    // Arrange
    const passwordHash = hashPassword('s')
    repo.findByEmailWithPassword.mockResolvedValue(
      buildUserWithHash(passwordHash, { id: 'user-1', email: 'u@test.com' }),
    )

    // Act
    await loginUser(repo, sign as unknown as SignToken, {
      email: 'u@test.com',
      password: 's',
    })

    // Assert
    const payload = sign.mock.calls[0]?.[0] as {
      sub: string
      email: string
      jti: string
    }
    expect(payload.sub).toBe('user-1')
    expect(payload.email).toBe('u@test.com')
    expect(payload.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('lança INVALID_CREDENTIALS quando usuário não existe', async () => {
    // Arrange
    repo.findByEmailWithPassword.mockResolvedValue(null)

    // Act / Assert
    await expect(
      loginUser(repo, sign as unknown as SignToken, {
        email: 'nao-existe@test.com',
        password: 'qualquer',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 })

    expect(sign).not.toHaveBeenCalled()
  })

  it('lança INVALID_CREDENTIALS quando a senha está errada', async () => {
    // Arrange
    repo.findByEmailWithPassword.mockResolvedValue(
      buildUserWithHash(hashPassword('senha-real')),
    )

    // Act / Assert
    await expect(
      loginUser(repo, sign as unknown as SignToken, {
        email: 'u@test.com',
        password: 'senha-errada',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 })

    expect(sign).not.toHaveBeenCalled()
  })

  it('não distingue erro entre "email não existe" e "senha errada" (anti-enumeração)', async () => {
    // Arrange — Caminho 1
    repo.findByEmailWithPassword.mockResolvedValueOnce(null)
    let err1: unknown
    try {
      await loginUser(repo, sign as unknown as SignToken, {
        email: 'a@x.com',
        password: 'x',
      })
    } catch (e) {
      err1 = e
    }

    // Arrange — Caminho 2
    repo.findByEmailWithPassword.mockResolvedValueOnce(
      buildUserWithHash(hashPassword('certa')),
    )
    let err2: unknown
    try {
      await loginUser(repo, sign as unknown as SignToken, {
        email: 'b@x.com',
        password: 'errada',
      })
    } catch (e) {
      err2 = e
    }

    // Assert
    expect(err1).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    })
    expect(err2).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    })
    expect((err1 as Error).message).toBe((err2 as Error).message)
  })
})

describe('AuthService.logoutUser', () => {
  let blocklist: Mocked<Blocklist>

  beforeEach(() => {
    blocklist = buildBlocklist()
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adiciona jti à blocklist com TTL = exp - now', async () => {
    const now = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000)
    const exp = now + 900

    await logoutUser(blocklist, { jti: 'abc-123', exp })

    expect(blocklist.add).toHaveBeenCalledOnce()
    expect(blocklist.add).toHaveBeenCalledWith('abc-123', 900)
  })

  it('ainda chama blocklist.add quando token já expirou (impl decide pular)', async () => {
    const now = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000)
    const expired = now - 100

    await logoutUser(blocklist, { jti: 'expirado', exp: expired })

    expect(blocklist.add).toHaveBeenCalledOnce()
    expect(blocklist.add).toHaveBeenCalledWith('expirado', -100)
  })
})
