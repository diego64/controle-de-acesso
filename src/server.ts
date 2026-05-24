import { buildApp } from '@/app.js'
import { env } from '@/config/env.js'

async function bootstrap(): Promise<void> {
  const app = await buildApp()

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      app.log.info({ signal }, 'shutting down')
      void app.close().then(() => process.exit(0))
    })
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
  } catch (err) {
    app.log.fatal({ err }, 'failed to start server')
    process.exit(1)
  }
}

void bootstrap()
