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
import { matchPaths } from './matchers'
import type { Configuration, FieldMatcher, MiddlewareParams } from './types'
import { getStringLeafPaths } from './visitor'

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

export function encryptOnWrite(
  params: MiddlewareParams,
  keys: KeysConfiguration,
  matchers: FieldMatcher[],
  operation: string
) {
  const dataPaths = getStringLeafPaths(params.args)
  const paths = matchPaths(dataPaths, matchers)

  console.dir(
    {
      dataPaths,
      matchers,
      encryptionPaths: paths
    },
    { depth: Infinity }
  )

  // We use immer to clone parts of the params tree that need editing,
  // to avoid mutating user-side query object references.
  // See https://github.com/47ng/prisma-field-encryption/issues/3
  paths.forEach(({ path }) => {
    try {
      // no need to check for fieldConfig.encrypt, fields have been filtered
      // out when building the matchers list
      const cleartext = objectPath.get(params.args, path)
      const ciphertext = encryptStringSync(cleartext, keys.encryptionKey)
      console.dir({ path, cleartext, ciphertext })
      objectPath.set(params.args, path, ciphertext)
    } catch (error) {
      console.error(
        `[prisma-field-encryption] Error encrypting field ${path} (in operation ${operation}): ${error}`
      )
    }
  })
}

export function decryptOnRead(
  params: MiddlewareParams,
  result: any,
  keys: KeysConfiguration,
  matchers: FieldMatcher[],
  operation: string
) {
  const resultPaths = getStringLeafPaths(result)
  const paths = matchPaths(resultPaths, matchers)

  console.dir(
    { resultPaths, decryptionPaths: paths, matchers },
    { depth: Infinity }
  )

  // No need to deep clone the data as it comes from the database,
  // nobody else has a reference on it.
  paths.forEach(({ path, fieldConfig }) => {
    try {
      const ciphertext = objectPath.get(result, path)
      if (!cloakedStringRegex.test(ciphertext)) {
        return
      }
      const decryptionKey = findKeyForMessage(ciphertext, keys.keychain)
      const cleartext = decryptStringSync(ciphertext, decryptionKey)
      console.dir({ path, ciphertext, cleartext })
      objectPath.set(result, path, cleartext)
    } catch (error) {
      console.error(
        `[prisma-field-encryption] Error decrypting field ${path} (in operation ${operation}): ${error} `
      )
    }
  })
}
