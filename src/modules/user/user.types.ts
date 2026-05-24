import type { UserRole } from '@/models/user.model.js'

export type { UserRole }

export interface UserDTO {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface UserWithHashDTO extends UserDTO {
  passwordHash: string
}

export interface CreateUserInput {
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  role?: UserRole
}
