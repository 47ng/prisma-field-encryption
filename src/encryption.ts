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
import objectPath from 'object-path'
import type { DMMFModels } from './dmmf'
import { errors, warnings } from './errors'
import type { Configuration, MiddlewareParams } from './types'
import { visitInputTargetFields, visitOutputTargetFields } from './visitor'

export interface KeysConfiguration {
  encryptionKey: ParsedCloakKey
  keychain: CloakKeychain
}

export function configureKeys(config: Configuration): KeysConfiguration {
  const encryptionKey =
    config.encryptionKey || process.env.PRISMA_FIELD_ENCRYPTION_KEY

  if (!encryptionKey) {
    throw new Error(errors.noEncryptionKey)
  }

  const decryptionKeysFromEnv = (process.env.PRISMA_FIELD_DECRYPTION_KEYS ?? '')
    .split(',')
    .filter(Boolean)

  const decryptionKeys: string[] = Array.from(
    new Set([
      encryptionKey,
      ...(config.decryptionKeys ?? decryptionKeysFromEnv)
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
  keys: KeysConfiguration,
  models: DMMFModels,
  operation: string
) {
  if (!writeOperations.includes(params.action)) {
    return // No input data to encrypt
  }

  const encryptionErrors: string[] = []

  visitInputTargetFields(
    params,
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
        const cipherText = encryptStringSync(clearText, keys.encryptionKey)
        objectPath.set(params.args, path, cipherText)
      } catch (error) {
        encryptionErrors.push(
          errors.fieldEncryptionError(model, field, path, error)
        )
      }
    }
  )
  if (encryptionErrors.length > 0) {
    throw new Error(errors.encryptionErrorReport(operation, encryptionErrors))
  }
}

export function decryptOnRead(
  params: MiddlewareParams,
  result: any,
  keys: KeysConfiguration,
  models: DMMFModels,
  operation: string
) {
  // Analyse the query to see if there's anything to decrypt.
  const model = models[params.model!]
  if (Object.keys(model.fields).length === 0 && !params.args.include) {
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
        if (!cloakedStringRegex.test(cipherText)) {
          return
        }
        const decryptionKey = findKeyForMessage(cipherText, keys.keychain)
        const clearText = decryptStringSync(cipherText, decryptionKey)
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
