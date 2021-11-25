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
import rfdc from 'rfdc'
import type {
  Configuration,
  FieldsConfiguration,
  MiddlewareParams
} from './types'
import { getStringLeafPaths } from './visitor'

const clone = rfdc({
  proto: true
})

export interface EncryptionConfiguration {
  encryptOnWrite: boolean
  decryptOnRead: boolean
}

export interface KeysConfiguration {
  encryptionKey: ParsedCloakKey
  keychain: CloakKeychain
}

export function configureEncryption(
  params: MiddlewareParams,
  fields: FieldsConfiguration
): EncryptionConfiguration {
  if (!params.model) {
    // Model is not available for raw SQL & execute.
    // For now those operations are not supported.
    return {
      encryptOnWrite: false,
      decryptOnRead: false
    }
  }

  const action = String(params.action)
  const model = String(params.model)

  const isModelEnabled = Object.entries(fields).some(
    ([key, value]) => key.split('.')[0] === model && value === true
  )

  const isWriteOperation = [
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert'
  ].includes(action)

  return {
    encryptOnWrite: isWriteOperation ? isModelEnabled : false,
    decryptOnRead: isModelEnabled
  }
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

const lowercaseFirstLetter = (input: string) =>
  input[0].toLowerCase() + input.slice(1)

export function encryptOnWrite(
  data: any,
  keys: KeysConfiguration,
  fields: FieldsConfiguration,
  model?: string
) {
  // Deep-clone the input to avoid mutating it.
  // (eg: if reusing objects across queries)
  const copy = clone(data)

  // From the configuration, lowercase the first letter of the models
  // to match the `include` behaviour in Prisma queries.
  const encryptedFieldPaths = Object.entries(fields)
    .filter(([, value]) => value === true)
    .flatMap(([key]) => {
      const [model, field] = key.split('.')
      return [
        [lowercaseFirstLetter(model), field].join('.'),
        [lowercaseFirstLetter(model) + 's', 'update', 'data', field].join('.')
      ]
    })

  const paths = getStringLeafPaths(data).filter(dataPath => {
    // When the dataPath has only one item (root level),
    // we use the model we're working on as the parentKey.
    // todo: Handle the {model}s.update.data.{field} case
    const [leafKey, parentKey = model ?? '', ...rest] = dataPath
      .split('.')
      .reverse()

    if (parentKey === 'data' && rest[0] === 'update') {
      // Nested update
      const model = rest[1]
      return encryptedFieldPaths.includes(
        [model, 'update', 'data', leafKey].join('.')
      )
    }
    return encryptedFieldPaths.includes(
      [lowercaseFirstLetter(parentKey), leafKey].join('.')
    )
  })
  paths.forEach(path => {
    try {
      const cleartext = objectPath.get(copy, path)
      const ciphertext = encryptStringSync(cleartext, keys.encryptionKey)
      objectPath.set(copy, path, ciphertext)
    } catch (error) {
      console.error(
        `[prisma-field-encryption] Error encrypting field ${path}: ${error}`
      )
    }
  })
  return copy
}

export function decryptOnRead(data: any, keys: KeysConfiguration) {
  const paths = getStringLeafPaths(data)
  // No need to deep clone the data as it comes from the database,
  // nobody else has a reference on it.
  paths.forEach(path => {
    try {
      const ciphertext = objectPath.get(data, path)
      if (!ciphertext.match(cloakedStringRegex)) {
        return
      }
      const decryptionKey = findKeyForMessage(ciphertext, keys.keychain)
      const cleartext = decryptStringSync(ciphertext, decryptionKey)
      objectPath.set(data, path, cleartext)
    } catch (error) {
      console.error(
        `[prisma-field-encryption] Error decrypting field ${path}: ${error}`
      )
    }
  })
  return data
}
