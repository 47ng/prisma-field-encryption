import { defineConfig } from 'tsdown'

export default defineConfig([
  // Main library
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    dts: true,
    clean: true,
    platform: 'node',
    target: 'node24',
    outExtensions: () => ({ js: '.js', dts: '.d.ts' })
  },
  // CLI generator (needs shebang)
  {
    entry: ['src/generator/main.ts'],
    format: ['esm'],
    outDir: 'dist/generator',
    dts: false,
    platform: 'node',
    target: 'node24',
    banner: { js: '#!/usr/bin/env node' },
    outExtensions: () => ({ js: '.js' })
  }
])
