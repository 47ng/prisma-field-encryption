import { analyseSchema, analyseSchemaFile, findSchemaPath } from './ast'
import { debug } from './debugger'
import { analyseDMMF } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

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

export function fieldEncryptionMiddleware<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}): Middleware<Models, Actions> {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = resolveModels(config)
  debug.setup('Models: %O', models)

  return async function fieldEncryptionMiddleware(
    params: MiddlewareParams<Models, Actions>,
    next: (params: MiddlewareParams<Models, Actions>) => Promise<any>
  ) {
    if (!params.model) {
      // Unsupported operation
      debug.runtime('Unsupported operation (missing model): %O', params)
      return await next(params)
    }
    const operation = `${params.model}.${params.action}`
    // Params are mutated in-place for modifications to occur.
    // See https://github.com/prisma/prisma/issues/9522
    const encryptedParams = encryptOnWrite(params, keys, models, operation)
    let result = await next(encryptedParams)
    decryptOnRead(encryptedParams, result, keys, models, operation)
    return result
  }
}
