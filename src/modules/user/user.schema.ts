import { z } from 'zod'

const userSummarySchema = z.object({
  id: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['ADMINISTRADOR', 'USUARIO']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const listUsersResponseSchema = z.array(userSummarySchema)

export const listUsersFastifySchema = {
  response: {
    200: z.toJSONSchema(listUsersResponseSchema, { target: 'draft-7' }),
  },
}
