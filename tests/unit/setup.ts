// Definir env vars antes de qualquer import que carregue src/config/env.ts.
// HASH_ITERATIONS=1 derruba o custo do PBKDF2 (~100ms → microssegundos)
// sem afetar a corretude dos testes (formato hash:salt e timingSafeEqual
// continuam idênticos). Em produção/dev fica nos 100_000 padrão.
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.LOG_LEVEL = 'error'
process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-secret-min-32-chars-test-secret-aaa'
process.env.JWT_EXPIRES_IN = '15m'
process.env.HASH_ITERATIONS = '1'
process.env.HASH_KEYLEN = '64'
process.env.HASH_DIGEST = 'sha512'
