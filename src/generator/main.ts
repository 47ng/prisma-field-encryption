#!/usr/bin/env node

import { generatorHandler } from '@prisma/generator-helper'
import fs from 'node:fs/promises'
import { analyseSchema } from '../ast'
import { analyseDMMF } from '../dmmf'
import { generateIndex } from './generateIndex'
import { generateModel } from './generateModel'
import { getPrismaClientModule } from './prismaModule'

export interface Config {
  concurrently?: boolean
}

generatorHandler({
  onManifest() {
    return {
      prettyName: 'field-level encryption migrations',
      version: require('../../package.json').version,
      requiresGenerators: ['prisma-client-js'],
      defaultOutput: 'migrations'
    }
  },
  async onGenerate(options) {
    // Try AST-based parsing first (using schema datamodel string),
    // fall back to DMMF for older Prisma versions
    let models
    try {
      models = analyseSchema(options.datamodel)
    } catch {
      models = analyseDMMF(options.dmmf)
    }
    const outputDir = options.generator.output?.value!
    const concurrently = options.generator.config?.concurrently === 'true'
    const prismaClient = options.otherGenerators.find(
      each => each.provider.value === 'prisma-client-js'
    )!

    // mkdir -p
    try {
      await fs.mkdir(outputDir, { recursive: true })
    } catch {}

    // Keep only models with encrypted fields & a valid cursor
    const validModels = Object.fromEntries(
      Object.entries(models).filter(
        ([, model]) =>
          Object.keys(model.fields).length > 0 && Boolean(model.cursor)
      )
    )
    const prismaClientOutput =
      prismaClient.output?.value ?? 'node_modules/@prisma/client'

    const prismaClientModule = getPrismaClientModule(
      prismaClientOutput,
      outputDir
    )

    const longestModelNameLength = Object.keys(validModels).reduce(
      (max, model) => Math.max(max, model.length),
      0
    )

    await Promise.all(
      Object.entries(validModels).map(([modelName, model]) =>
        generateModel({
          modelName,
          model,
          outputDir,
          prismaClientModule
        })
      )
    )
    await generateIndex({
      concurrently,
      models: validModels,
      outputDir,
      prismaClientModule,
      modelNamePad: longestModelNameLength
    })
  }
})
