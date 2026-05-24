import type { UserRole } from '@/models/user.model.js'

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface RegisterOutput {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  createdAt: Date
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginOutput {
  accessToken: string
  expiresIn: string
}

export interface TokenPayload {
  sub: string
  email: string
  jti: string
}

export type SignToken = (payload: TokenPayload) => string

export interface LogoutInput {
  jti: string
  exp: number
}
