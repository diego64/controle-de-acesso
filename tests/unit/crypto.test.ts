import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/shared/crypto.js'

describe('crypto.hashPassword', () => {
  it('retorna string no formato hash:salt em hex', () => {
    // Arrange
    const password = 'minhasenha'

    // Act
    const result = hashPassword(password)

    // Assert
    const parts = result.split(':')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^[0-9a-f]+$/)
    expect(parts[1]).toMatch(/^[0-9a-f]+$/)
  })

  it('gera salts diferentes a cada chamada (mesma senha → hashes diferentes)', () => {
    // Arrange / Act
    const h1 = hashPassword('senha-igual')
    const h2 = hashPassword('senha-igual')

    // Assert
    expect(h1).not.toBe(h2)
  })

  it('hash tem 128 hex chars (HASH_KEYLEN=64 bytes) e salt tem 64 hex chars (32 bytes)', () => {
    // Arrange / Act
    const result = hashPassword('x')
    const [hash, salt] = result.split(':')

    // Assert
    expect(hash).toHaveLength(128)
    expect(salt).toHaveLength(64)
  })
})

describe('crypto.verifyPassword', () => {
  it('retorna true quando a senha bate', () => {
    // Arrange
    const stored = hashPassword('senha-correta')

    // Act
    const result = verifyPassword('senha-correta', stored)

    // Assert
    expect(result).toBe(true)
  })

  it('retorna false quando a senha está errada', () => {
    // Arrange
    const stored = hashPassword('senha-correta')

    // Act
    const result = verifyPassword('senha-errada', stored)

    // Assert
    expect(result).toBe(false)
  })

  it('retorna false quando stored não tem separador ":"', () => {
    // Arrange / Act
    const result = verifyPassword('qualquer', 'semseparador')

    // Assert
    expect(result).toBe(false)
  })

  it('retorna false quando stored tem mais de um separador', () => {
    // Arrange / Act
    const result = verifyPassword('qualquer', 'a:b:c')

    // Assert
    expect(result).toBe(false)
  })

  it('retorna false quando o hash está vazio', () => {
    // Act
    const result = verifyPassword('qualquer', ':somesalt')

    // Assert
    expect(result).toBe(false)
  })

  it('retorna false quando o salt está vazio', () => {
    // Act
    const result = verifyPassword('qualquer', 'somehash:')

    // Assert
    expect(result).toBe(false)
  })

  it('retorna false quando o hash não tem o tamanho esperado de HASH_KEYLEN', () => {
    // Arrange — hash com 4 chars hex (2 bytes) em vez de 128 chars (64 bytes)
    const malformed = 'abcd:somesalt'

    // Act
    const result = verifyPassword('qualquer', malformed)

    // Assert
    expect(result).toBe(false)
  })

  it('não lança em entradas malformadas (defesa contra crash)', () => {
    // Act / Assert
    expect(() => verifyPassword('x', '')).not.toThrow()
    expect(() => verifyPassword('x', ':')).not.toThrow()
    expect(() => verifyPassword('x', 'lixoaleatorio')).not.toThrow()
  })
})
