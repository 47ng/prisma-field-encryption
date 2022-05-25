import { analyseDMMF } from './dmmf'
import {
  configureKeys,
  decryptOnRead,
  encryptOnWrite,
  ConfigureKeysParams
} from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

export function fieldEncryptionMiddleware(
  config: Configuration = {}
): Middleware {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const configureKeysParams: ConfigureKeysParams = {
    encryptionKey: config.encryptionKey,
    decryptionKeys: config.decryptionKeys
  }

  const keys = configureKeys(configureKeysParams)
  const models = analyseDMMF()

  return async function fieldEncryptionMiddleware(
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => Promise<any>
  ) {
    if (!params.model) {
      // Unsupported operation
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
