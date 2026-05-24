import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('ioredis', async () => {
  const mod = await import('ioredis-mock')
  return { Redis: mod.default, default: mod.default }
})

import type { FastifyInstance } from 'fastify'
import { buildApp } from '@/app.js'

describe('Health E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ testing: true })
    await app.ready()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /health/live', () => {
    it('200 - sempre retorna status: ok', async () => {
      // Act
      const response = await app.inject({ method: 'GET', url: '/health/live' })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body) as Record<string, unknown>
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeTypeOf('string')
    })
  })

  describe('GET /health/ready', () => {
    it('200 - retorna ok quando mongo e redis estão alcançáveis', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body) as {
        status: string
        services: { mongodb: string; redis: string }
        timestamp: string
      }
      expect(body.status).toBe('ok')
      expect(body.services.mongodb).toBe('ok')
      expect(body.services.redis).toBe('ok')
      expect(body.timestamp).toBeTypeOf('string')
    })

    it('503 - retorna down quando redis.ping falha', async () => {
      // Arrange — força um único ping a rejeitar (afterEach restaura)
      vi.spyOn(app.redis, 'ping').mockRejectedValueOnce(new Error('redis down'))

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      })

      // Assert
      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.body) as {
        status: string
        services: { mongodb: string; redis: string }
      }
      expect(body.status).toBe('down')
      expect(body.services.redis).toBe('down')
      expect(body.services.mongodb).toBe('ok')
    })

    it('503 - retorna down quando redis.ping responde algo diferente de PONG', async () => {
      // Arrange — resposta inesperada do redis
      vi.spyOn(app.redis, 'ping').mockResolvedValueOnce('WAT' as never)

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      })

      // Assert
      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.body) as {
        services: { redis: string }
      }
      expect(body.services.redis).toBe('down')
    })
  })
})
