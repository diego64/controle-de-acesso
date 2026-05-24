import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo: MongoMemoryServer | undefined

export async function setup(): Promise<void> {
  mongo = await MongoMemoryServer.create({
    instance: { dbName: 'controle-de-acesso-test' },
  })

  process.env.NODE_ENV = 'test'
  process.env.PORT = '3000'
  process.env.LOG_LEVEL = 'error'
  process.env.MONGODB_URI = mongo.getUri('controle-de-acesso-test')
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.JWT_SECRET = 'test-secret-min-32-chars-test-secret-aaa'
  process.env.JWT_EXPIRES_IN = '15m'
  process.env.HASH_ITERATIONS = '1'
  process.env.HASH_KEYLEN = '64'
  process.env.HASH_DIGEST = 'sha512'
}

export async function teardown(): Promise<void> {
  await mongo?.stop()
}
