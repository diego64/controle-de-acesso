import type { Types } from 'mongoose'
import { UserModel, type IUser } from '@/models/user.model.js'
import { AppError } from '@/shared/errors/AppError.js'
import type {
  CreateUserInput,
  UserDTO,
  UserWithHashDTO,
} from './user.types.js'

export interface UserRepository {
  findByEmail(email: string): Promise<UserDTO | null>
  findByEmailWithPassword(email: string): Promise<UserWithHashDTO | null>
  findById(id: string): Promise<UserDTO | null>
  findAll(): Promise<UserDTO[]>
  create(data: CreateUserInput): Promise<UserDTO>
}

type LeanUser = IUser & { _id: Types.ObjectId }

export class MongoUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserDTO | null> {
    const doc = await UserModel.findOne({ email: normalizeEmail(email) })
      .lean<LeanUser>()
      .exec()
    return doc ? toDTO(doc) : null
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithHashDTO | null> {
    const doc = await UserModel.findOne({ email: normalizeEmail(email) })
      .select('+passwordHash')
      .lean<LeanUser>()
      .exec()
    return doc ? toDTOWithHash(doc) : null
  }

  async findById(id: string): Promise<UserDTO | null> {
    const doc = await UserModel.findById(id).lean<LeanUser>().exec()
    return doc ? toDTO(doc) : null
  }

  async findAll(): Promise<UserDTO[]> {
    const docs = await UserModel.find().sort({ createdAt: -1 }).lean<LeanUser[]>().exec()
    return docs.map(toDTO)
  }

  async create(data: CreateUserInput): Promise<UserDTO> {
    try {
      const doc = await UserModel.create(data)
      return {
        id: doc._id.toString(),
        email: doc.email,
        firstName: doc.firstName,
        lastName: doc.lastName,
        role: doc.role,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        throw new AppError('EMAIL_ALREADY_EXISTS', 409)
      }
      throw err
    }
  }
}

function toDTO(doc: LeanUser): UserDTO {
  return {
    id: doc._id.toString(),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    role: doc.role,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toDTOWithHash(doc: LeanUser): UserWithHashDTO {
  return {
    ...toDTO(doc),
    passwordHash: doc.passwordHash,
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 11000
  )
}
