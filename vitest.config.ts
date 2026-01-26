import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/tests/**'],
          sequence: { groupOrder: 1 }
        }
      },
      {
        test: {
          name: 'integration',
          include: ['src/tests/*.test.ts'],
          pool: 'forks',
          maxWorkers: 1,
          isolate: false, // equivalent to Jest's --runInBand
          sequence: { groupOrder: 2 }
        }
      }
    ],
    coverage: {
      enabled: Boolean(process.env.CI),
      provider: 'v8',
      reporter: ['json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/tests/**']
    }
  }
})
