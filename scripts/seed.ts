// IMPORTANTE: side-effect import deve ser PRIMEIRO — carrega .env
// (com override sobre o shell) antes de qualquer import que leia env.
import './_load-env.js'

import mongoose from 'mongoose'
import { env } from '@/config/env.js'
import { UserModel, type UserRole } from '@/models/user.model.js'
import { hashPassword } from '@/shared/crypto.js'

interface SeedUser {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@local.dev',
    password: 'admin-local-dev-2026',
    firstName: 'Admin',
    lastName: 'Local',
    role: 'ADMINISTRADOR',
  },
  {
    email: 'usuario@local.dev',
    password: 'usuario-local-dev-2026',
    firstName: 'Usuário',
    lastName: 'Comum',
    role: 'USUARIO',
  },
]

async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed não pode rodar em production — abortando.')
  }

  await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 5 })
  console.log(`✓ Mongo conectado (db=${mongoose.connection.name})`)

  for (const u of SEED_USERS) {
    const existing = await UserModel.findOne({ email: u.email }).lean().exec()
    if (existing) {
      console.log(`  [skip]    ${u.role.padEnd(13)} ${u.email}  (já existe)`)
      continue
    }
    const passwordHash = hashPassword(u.password)
    const created = await UserModel.create({
      email: u.email,
      passwordHash,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
    })
    console.log(
      `  [created] ${u.role.padEnd(13)} ${u.email}  (id=${created._id.toString()})`,
    )
  }

  await mongoose.disconnect()

  console.log('')
  console.log('✓ Seed concluído')
  console.log('')
  console.log('═══ Credenciais de DEV (NÃO usar em produção) ═══')
  for (const u of SEED_USERS) {
    console.log(`  ${u.role.padEnd(13)} → ${u.email} / ${u.password}`)
  }
}

seed().catch((err: unknown) => {
  console.error('✗ Erro no seed:', err)
  process.exit(1)
})
