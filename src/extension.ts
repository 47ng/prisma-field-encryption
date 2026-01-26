import { Prisma } from '@prisma/client/extension'
import { debug } from './debugger'
import { analyseDMMF } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, DMMFDocument, MiddlewareParams } from './types'

async function getDMMF(config: Configuration): Promise<DMMFDocument> {
  if (config.dmmf) {
    return config.dmmf
  }
  // Dynamic import for use in user's project where @prisma/client is generated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PrismaModule = (await import('@prisma/client')) as any
  return PrismaModule.Prisma.dmmf as DMMFDocument
}

export async function fieldEncryptionExtension<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}) {
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = analyseDMMF(await getDMMF(config))
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
