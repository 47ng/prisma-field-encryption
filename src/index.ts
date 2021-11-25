import {
  configureEncryption,
  configureKeys,
  decryptOnRead,
  encryptOnWrite
} from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

export function fieldEncryptionMiddleware<
  Models extends string,
  Actions extends string
>(config: Configuration<Models>): Middleware<Models, Actions> {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)

  return async (
    params: MiddlewareParams<Models, Actions>,
    next: (params: MiddlewareParams<Models, Actions>) => Promise<any>
  ) => {
    const encryptionConfig = configureEncryption(params, config)

    const logger =
      process.env.PRISMA_FIELD_ENCRYPTION_LOG === 'false'
        ? {
            log: (_args: any) => {},
            info: (_args: any) => {},
            dir: (_args: any) => {},
            error: console.error, // Still log errors
            warn: console.warn // and warnings
          }
        : console

    const operation = `${params.model}.${params.action}`

    logger.info('------------------------------------------------------------')
    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - pre-encrypt`,
        config,
        context: {
          ...keys,
          ...encryptionConfig
        },
        params
      },
      { depth: Infinity }
    )

    if (encryptionConfig.encryptOnWrite) {
      const data = encryptOnWrite(params.args.data, keys, config, params.model)
      params.args.data = data
    }

    logger.dir(
      {
        _: `${operation} - fieldEncryptionMiddleware - before next`,
        params
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

    if (encryptionConfig.decryptOnRead) {
      result = decryptOnRead(result, keys)
    }

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
