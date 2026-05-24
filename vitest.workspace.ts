import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
      setupFiles: ['./tests/unit/setup.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'e2e',
      include: ['tests/e2e/**/*.test.ts'],
      globalSetup: ['./tests/e2e/global-setup.ts'],
      pool: 'forks',
      poolOptions: {
        forks: { singleFork: true },
      },
    },
  },
])
