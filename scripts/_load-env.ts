// Side-effect: lê .env e ESCREVE em process.env (com override).
// O --env-file do Node 20 não sobrescreve vars já exportadas no shell,
// então um MONGODB_URI persistente no .bashrc/.zshrc do dev silenciosamente
// vencia o .env. Este loader força .env a ser a fonte de verdade nos scripts.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')

try {
  const text = readFileSync(envPath, 'utf-8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    process.env[key] = value
  }
} catch {
  // .env opcional — Zod em src/config/env.ts vai falhar com mensagem útil
  // se vars críticas não estiverem nem no .env nem no shell.
}
