import {
  cloakedStringRegex,
  CloakKeychain,
  decryptStringSync,
  encryptStringSync,
  findKeyForMessage,
  makeKeychainSync,
  ParsedCloakKey,
  parseKeySync
} from '@47ng/cloak'
import produce, { Draft } from 'immer'
import objectPath from 'object-path'
import type { DMMFModels } from './dmmf'
import { errors, warnings } from './errors'
import type {
  MiddlewareParams,
  EncryptionFn,
  DecryptionFn,
  Configuration,
  CipherFunctions,
  Keys
} from './types'
import { visitInputTargetFields, visitOutputTargetFields } from './visitor'

export interface KeysConfiguration {
  encryptionKey: ParsedCloakKey
  keychain: CloakKeychain
}

export interface FunctionsConfiguration {
  encryptFn: EncryptionFn
  decryptFn: DecryptionFn
}

export interface ConfigureKeysParams {
  encryptionKey?: string
  decryptionKeys?: string[]
}

export interface KeysAndFunctionsConfiguration {
  keys: KeysConfiguration | null
  cipherFunctions: CipherFunctions | null
  method: Method
}

const ENCRYPTION_KEY_PROP = 'encryptionKey'
const DECRYPTION_KEYS_PROP = 'decryptionKeys'
const ENCRYPTION_FN_PROP = 'encryptFn'
const DECRYPTION_FN_PROP = 'decryptFn'

export type Method = 'CUSTOM' | 'DEFAULT'

export function configureKeysAndFunctions(
  config: Configuration
): KeysAndFunctionsConfiguration {
  const method: Method = getMethod(config)
  const keys = method === 'DEFAULT' ? configureKeys(config) : null
  const cipherFunctions =
    method === 'CUSTOM' ? configureFunctions(config) : null

  return { cipherFunctions, keys, method }
}

export function getMethod(config: Configuration): Method {
  if (isDefaultConfiguration(config)) {
    return 'DEFAULT'
  }

  if (isCustomConfiguration(config)) {
    return 'CUSTOM'
  }

  throw new Error(errors.invalidConfig)
}

export function isDefaultConfiguration(config: Configuration): boolean {
  return !(ENCRYPTION_FN_PROP in config) && !(DECRYPTION_FN_PROP in config)
}

export function isCustomConfiguration(config: Configuration): boolean {
  return (
    ENCRYPTION_FN_PROP in config &&
    DECRYPTION_FN_PROP in config &&
    !(ENCRYPTION_KEY_PROP in config) &&
    !(DECRYPTION_KEYS_PROP in config)
  )
}

export function configureFunctions(
  config: Configuration
): FunctionsConfiguration {
  const encryptFn = (config as CipherFunctions)[ENCRYPTION_FN_PROP]
  const decryptFn = (config as CipherFunctions)[DECRYPTION_FN_PROP]

  if (typeof encryptFn !== 'function' || typeof decryptFn !== 'function') {
    throw new Error(errors.invalidFunctionsConfiguration)
  }

  const cipherFunctions = {
    encryptFn,
    decryptFn
  }

  return cipherFunctions
}

export function configureKeys(config: Configuration): KeysConfiguration {
  const configureKeysParams: ConfigureKeysParams = {
    encryptionKey: (config as Keys)[ENCRYPTION_KEY_PROP],
    decryptionKeys: (config as Keys)[DECRYPTION_KEYS_PROP]
  }

  const encryptionKey =
    configureKeysParams.encryptionKey || process.env.PRISMA_FIELD_ENCRYPTION_KEY

  if (!encryptionKey) {
    throw new Error(errors.noEncryptionKey)
  }

  const decryptionKeysFromEnv = (process.env.PRISMA_FIELD_DECRYPTION_KEYS ?? '')
    .split(',')
    .filter(Boolean)

  const decryptionKeys: string[] = Array.from(
    new Set([
      encryptionKey,
      ...(configureKeysParams.decryptionKeys ?? decryptionKeysFromEnv)
    ])
  )

  const keychain = makeKeychainSync(decryptionKeys)

  return {
    encryptionKey: parseKeySync(encryptionKey),
    keychain
  }
}

// --

const writeOperations = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert'
]

const whereClauseRegExp = /\.where\./

export function encryptOnWrite(
  params: MiddlewareParams,
  models: DMMFModels,
  operation: string,
  method: Method,
  keys: KeysConfiguration | null,
  encryptFn?: EncryptionFn
) {
  if (!writeOperations.includes(params.action)) {
    return params // No input data to encrypt
  }

  const encryptionErrors: string[] = []

  const mutatedParams = produce(params, (draft: Draft<MiddlewareParams>) => {
    visitInputTargetFields(
      draft,
      models,
      function encryptFieldValue({
        fieldConfig,
        value: clearText,
        path,
        model,
        field
      }) {
        if (!fieldConfig.encrypt) {
          return
        }
        if (whereClauseRegExp.test(path)) {
          console.warn(warnings.whereClause(operation, path))
        }
        try {
          let cipherText: string | undefined

          if (method === 'CUSTOM' && !!encryptFn) {
            cipherText = encryptFn(clearText)
          }

          if (method === 'DEFAULT' && !!keys) {
            cipherText = encryptStringSync(clearText, keys.encryptionKey)
          }

          if (!cipherText) {
            throw new Error(errors.invalidConfig)
          }

          objectPath.set(draft.args, path, cipherText)
        } catch (error) {
          encryptionErrors.push(
            errors.fieldEncryptionError(model, field, path, error)
          )
        }
      }
    )
  })
  if (encryptionErrors.length > 0) {
    throw new Error(errors.encryptionErrorReport(operation, encryptionErrors))
  }
  return mutatedParams
}

export function decryptOnRead(
  params: MiddlewareParams,
  result: any,
  models: DMMFModels,
  operation: string,
  method: Method,
  keys: KeysConfiguration | null,
  decryptFn?: DecryptionFn
) {
  // Analyse the query to see if there's anything to decrypt.
  const model = models[params.model!]
  if (Object.keys(model.fields).length === 0 && !params.args?.include) {
    // The queried model doesn't have any encrypted field,
    // and there are no included connections.
    // We can safely skip decryption for the returned data.
    // todo: Walk the include/select tree for a better decision.
    return
  }

  const decryptionErrors: string[] = []
  const fatalDecryptionErrors: string[] = []

  visitOutputTargetFields(
    params,
    result,
    models,
    function decryptFieldValue({
      fieldConfig,
      value: cipherText,
      path,
      model,
      field
    }) {
      try {
        if (!decryptFn && !cloakedStringRegex.test(cipherText)) {
          return
        }

        let clearText: string | undefined

        if (method === 'CUSTOM' && !!decryptFn) {
          clearText = decryptFn(cipherText)
        }

        if (method === 'DEFAULT' && !!keys) {
          clearText = decryptStringSync(
            cipherText,
            findKeyForMessage(cipherText, keys.keychain)
          )
        }

        if (!clearText) {
          throw new Error(errors.invalidConfig)
        }

        objectPath.set(result, path, clearText)
      } catch (error) {
        const message = errors.fieldDecryptionError(model, field, path, error)
        if (fieldConfig.strictDecryption) {
          fatalDecryptionErrors.push(message)
        } else {
          decryptionErrors.push(message)
        }
      }
    }
  )
  if (decryptionErrors.length > 0) {
    console.error(errors.encryptionErrorReport(operation, decryptionErrors))
  }
  if (fatalDecryptionErrors.length > 0) {
    throw new Error(
      errors.decryptionErrorReport(operation, fatalDecryptionErrors)
    )
  }
}
