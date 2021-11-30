import { analyseDMMF } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

export function fieldEncryptionMiddleware(
  config: Configuration = {}
): Middleware {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)
  const models = analyseDMMF()

  console.dir(
    {
      _: 'fieldEncryptionMiddleware - setup',
      keys,
      models
    },
    { depth: Infinity }
  )

  return async (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => Promise<any>
  ) => {
    const logger =
      process.env.PRISMA_FIELD_ENCRYPTION_LOG === 'true'
        ? console
        : {
            log: (_args: any) => {},
            info: (_args: any) => {},
            dir: (_args: any) => {},
            error: console.error, // Still log errors
            warn: console.warn // and warnings
          }

    if (!params.model) {
      // Unsupported operation
      return await next(params)
    }

    const operation = `${params.model}.${params.action}`

    logger.info('------------------------------------------------------------')
    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - pre-encrypt`,
        config,
        params
      },
      { depth: Infinity }
    )

    // Params are mutated in-place for modifications to occur.
    // See https://github.com/prisma/prisma/issues/9522
    encryptOnWrite(params, keys, models, operation)

    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - before next`,
        params: params
      },
      { depth: Infinity }
    )

    let result = await next(params)

    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - after next`,
        result
      },
      { depth: Infinity }
    )

    decryptOnRead(params, result, keys, models, operation)

    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - post-decrypt`,
        result
      },
      { depth: Infinity }
    )
    return result
  }
}
