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
    throw new Error('[prisma-field-encryption] No encryption key provided.')
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
        console.warn(`[prisma-field-encryption] Warning: you're using an encrypted field in a \`where\` clause.
  -> In ${operation}: ${path}
  This will not work, read more: https://github.com/47ng/prisma-field-encryption#caveats--limitations`)
      }
      try {
        const cipherText = encryptStringSync(clearText, keys.encryptionKey)
        objectPath.set(params.args, path, cipherText)
      } catch (error) {
        console.error(
          `[prisma-field-encryption] Error encrypting field ${model}.${field} at ${path} (in operation ${operation}): ${error}`
        )
      }
    }
  )
}

export function decryptOnRead(
  params: MiddlewareParams,
  result: any,
  keys: KeysConfiguration,
  models: DMMFModels,
  operation: string
) {
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
        console.error(
          `[prisma-field-encryption] Error decrypting field ${model}.${field} at ${path} (in operation ${operation}): ${error} `
        )
        if (fieldConfig.strictDecryption) {
          throw error
        }
      }
    }
  )
}
