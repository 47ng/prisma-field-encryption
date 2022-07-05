import { analyseDMMF } from './dmmf'
import {
  decryptOnRead,
  encryptOnWrite,
  configureKeysAndFunctions
} from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

export function fieldEncryptionMiddleware(
  config: Configuration = {}
): Middleware {
  const { cipherFunctions, keys, method } = configureKeysAndFunctions(config)

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

    const encryptedParams = encryptOnWrite(
      params,
      models,
      operation,
      method,
      keys,
      cipherFunctions?.encryptFn
    )

    let result = await next(encryptedParams)

    decryptOnRead(
      encryptedParams,
      result,
      models,
      operation,
      method,
      keys,
      cipherFunctions?.decryptFn
    )

    return result
  }
}
