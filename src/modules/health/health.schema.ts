import { z } from 'zod'

const liveResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.iso.datetime(),
})

export const liveFastifySchema = {
  response: {
    200: z.toJSONSchema(liveResponseSchema, { target: 'draft-7' }),
  },
}

const serviceStatusSchema = z.enum(['ok', 'down'])

const readyResponseSchema = z.object({
  status: serviceStatusSchema,
  services: z.object({
    mongodb: serviceStatusSchema,
    redis: serviceStatusSchema,
  }),
  timestamp: z.iso.datetime(),
})

export const readyFastifySchema = {
  response: {
    200: z.toJSONSchema(readyResponseSchema, { target: 'draft-7' }),
    503: z.toJSONSchema(readyResponseSchema, { target: 'draft-7' }),
  },
}
