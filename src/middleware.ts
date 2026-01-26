import { debug } from './debugger'
import { analyseDMMF } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

export function fieldEncryptionMiddleware<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}): Middleware<Models, Actions> {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = analyseDMMF(
    config.dmmf ?? require('@prisma/client').Prisma.dmmf
  )
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
