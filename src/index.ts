import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import { configureMatchers } from './matchers'
import type { Configuration, Middleware, MiddlewareParams } from './types'

export function fieldEncryptionMiddleware(
  config: Configuration = {}
): Middleware {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)
  const matchers = configureMatchers()

  console.dir(
    {
      _: 'fieldEncryptionMiddleware - setup',
      keys,
      matchers
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
      // Unsupported
      return await next(params)
    }

    const operation = `${params.model}.${params.action}`

    logger.info('------------------------------------------------------------')
    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - pre-encrypt`,
        config,
        context: {
          matchers
          // ...keys
        },
        params
      },
      { depth: Infinity }
    )
    const encryptionMatchers =
      matchers.encryption[params.model][params.action] ?? []

    if (encryptionMatchers.length) {
      // Params are mutated in-place for modifications to occur.
      // See https://github.com/prisma/prisma/issues/9522
      encryptOnWrite(params, keys, encryptionMatchers, operation)
    }

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

    decryptOnRead(params, result, keys, matchers.decryption, operation)

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
