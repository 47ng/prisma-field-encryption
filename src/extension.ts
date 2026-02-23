import { Prisma } from '@prisma/client/extension'
import { analyseSchema, analyseSchemaFile, findSchemaPath } from './ast'
import { debug } from './debugger'
import { analyseDMMF } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, MiddlewareParams } from './types'

function resolveModels(config: Configuration) {
  // Priority: schemaSource > schemaPath > dmmf > auto-detect schema > fallback to DMMF
  if (config.schemaSource) {
    return analyseSchema(config.schemaSource)
  }
  if (config.schemaPath) {
    return analyseSchemaFile(config.schemaPath)
  }
  if (config.dmmf) {
    return analyseDMMF(config.dmmf)
  }
  // Try to auto-detect schema file first (works with Prisma >= 6.16.0)
  const detectedPath = findSchemaPath()
  if (detectedPath) {
    try {
      return analyseSchemaFile(detectedPath)
    } catch {
      // Fall through to DMMF
    }
  }
  // Fallback to DMMF (works with Prisma < 6.16.0)
  try {
    return analyseDMMF(require('@prisma/client').Prisma.dmmf)
  } catch {
    throw new Error(
      '[prisma-field-encryption] Could not resolve schema. ' +
        'Please provide `schemaPath` or `dmmf` in the configuration. ' +
        'Starting with Prisma 6.16.0, DMMF no longer includes field documentation, ' +
        'so `schemaPath` pointing to your schema.prisma file is required.'
    )
  }
}

export function fieldEncryptionExtension<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}) {
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = resolveModels(config)
  debug.setup('Models: %O', models)

  return Prisma.defineExtension({
    name: 'prisma-field-encryption',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) {
            // Unsupported operation
            debug.runtime(
              'Unsupported operation %s (missing model): %O',
              operation,
              args
            )
            return await query(args)
          }
          const params: MiddlewareParams<Models, Actions> = {
            args,
            model: model as Models,
            action: operation as Actions,
            dataPath: [],
            runInTransaction: false
          }
          const encryptedParams = encryptOnWrite(
            params,
            keys,
            models,
            operation
          )
          let result = await query(encryptedParams.args)
          decryptOnRead(encryptedParams, result, keys, models, operation)
          return result
        }
      }
    }
  })
}
