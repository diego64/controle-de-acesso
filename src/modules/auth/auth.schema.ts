import { z } from 'zod'

const roleSchema = z.enum(['ADMINISTRADOR', 'USUARIO'])

// ─── Register ──────────────────────────────────────────────────────────────
export const registerBodySchema = z
  .object({
    email: z.email().max(255),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  })
  .strict()

const registerResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
})

export type RegisterBody = z.infer<typeof registerBodySchema>

export const registerFastifySchema = {
  body: z.toJSONSchema(registerBodySchema, { target: 'draft-7' }),
  response: {
    201: z.toJSONSchema(registerResponseSchema, { target: 'draft-7' }),
  },
}

// ─── Login ─────────────────────────────────────────────────────────────────
export const loginBodySchema = z
  .object({
    email: z.email().max(255),
    password: z.string().min(8).max(128),
  })
  .strict()

const loginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.string(),
})

export type LoginBody = z.infer<typeof loginBodySchema>

export const loginFastifySchema = {
  body: z.toJSONSchema(loginBodySchema, { target: 'draft-7' }),
  response: {
    200: z.toJSONSchema(loginResponseSchema, { target: 'draft-7' }),
  },
}

// ─── Me ────────────────────────────────────────────────────────────────────
const meResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
})

export const meFastifySchema = {
  response: {
    200: z.toJSONSchema(meResponseSchema, { target: 'draft-7' }),
  },
}
