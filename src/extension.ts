import { debug } from './debugger'
import { analyseDMMF } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import { Configuration, MiddlewareParams } from './types'

type AllOperationsArgs = {
  model?: string
  operation: string
  args: any
  query: (args: any) => Promise<any>
}

type CustomQuery = {
  $allOperations(args: AllOperationsArgs): Promise<any>
}

export function fieldEncryptionExtension<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}) {
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = analyseDMMF(
    config.dmmf ?? require('@prisma/client').Prisma.dmmf
  )
  debug.setup('Models: %O', models)

  return {
    name: 'prisma-field-encryption',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query
        }: AllOperationsArgs) {
          if (!model) {
            // Unsupported operation
            debug.runtime('Unsupported operation (missing model): %O', args)
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
  }
}
