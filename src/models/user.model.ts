import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from 'mongoose'

export const USER_ROLES = ['ADMINISTRADOR', 'USUARIO'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface IUser {
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export type UserHydrated = HydratedDocument<IUser>

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'USUARIO',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { passwordHash, __v, ...rest } = ret
        return rest
      },
    },
  },
)

// Guarda contra re-registro quando o módulo é re-avaliado num contexto isolado
// (ex.: Vitest com `isolate: true`, hot-reload).
export const UserModel: Model<IUser> =
  (mongoose.models.User as Model<IUser> | undefined) ??
  model<IUser>('User', userSchema)
