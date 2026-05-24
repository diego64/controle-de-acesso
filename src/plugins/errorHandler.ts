import type { FastifyError, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { AppError } from '@/shared/errors/AppError.js'

function errorHandlerPlugin(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.code,
        message: error.message,
      })
    }

    if (error.validation) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'VALIDATION_ERROR',
        message: 'Payload inválido',
      })
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.status(500).send({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: 'Erro interno',
    })
  })
}

export default fp(errorHandlerPlugin, { name: 'error-handler' })
