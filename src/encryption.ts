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
import { debug } from './debugger'
import type { DMMFModels } from './dmmf'
import { errors, warnings } from './errors'
import { hashString } from './hash'
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

export function encryptOnWrite<Models extends string, Actions extends string>(
  params: MiddlewareParams<Models, Actions>,
  keys: KeysConfiguration,
  models: DMMFModels,
  operation: string
) {
  debug.encryption('Clear-text input: %O', params)
  const encryptionErrors: string[] = []
  const mutatedParams = produce(
    params,
    (draft: Draft<MiddlewareParams<Models, Actions>>) => {
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
          const hashedPath = rewriteHashedFieldPath(
            path,
            field,
            fieldConfig.hash?.targetField ?? field + 'Hash'
          )
          if (hashedPath) {
            if (!fieldConfig.hash) {
              console.warn(warnings.whereConnectClauseNoHash(operation, path))
            } else {
              const hash = hashString(clearText, fieldConfig.hash)
              debug.encryption(
                `Swapping encrypted search of ${model}.${field} with hash search under ${fieldConfig.hash.targetField} (hash: ${hash})`
              )
              objectPath.del(draft.args, path)
              objectPath.set(draft.args, hashedPath, hash)
              return
            }
          }
          if (isOrderBy(path, field, clearText)) {
            // Remove unsupported orderBy clause on encrypted text
            // (makes no sense to sort ciphertext nor to encrypt 'asc' | 'desc')
            console.error(errors.orderByUnsupported(model, field))
            debug.encryption(
              `Removing orderBy clause on ${model}.${field} at path \`${path}: ${clearText}\``
            )
            objectPath.del(draft.args, path)
            return
          }
          try {
            const cipherText = encryptStringSync(clearText, keys.encryptionKey)
            objectPath.set(draft.args, path, cipherText)
            debug.encryption(`Encrypted ${model}.${field} at path \`${path}\``)
            if (fieldConfig.hash) {
              const hash = hashString(clearText, fieldConfig.hash)
              const hashPath = rewriteWritePath(
                path,
                field,
                fieldConfig.hash.targetField
              )
              objectPath.set(draft.args, hashPath, hash)
              debug.encryption(
                `Added hash ${hash} of ${model}.${field} under ${fieldConfig.hash.targetField}`
              )
            }
          } catch (error) {
            encryptionErrors.push(
              errors.fieldEncryptionError(model, field, path, error)
            )
          }
        }
      )
    }
  )
  if (encryptionErrors.length > 0) {
    throw new Error(errors.encryptionErrorReport(operation, encryptionErrors))
  }
  debug.encryption('Encrypted input: %O', mutatedParams)
  return mutatedParams
}

export function decryptOnRead<Models extends string, Actions extends string>(
  params: MiddlewareParams<Models, Actions>,
  result: any,
  keys: KeysConfiguration,
  models: DMMFModels,
  operation: string
) {
  // Analyse the query to see if there's anything to decrypt.
  const model = models[params.model!]
  if (
    Object.keys(model.fields).length === 0 &&
    !params.args?.include &&
    !params.args?.select
  ) {
    // The queried model doesn't have any encrypted field,
    // and there are no included connections.
    // We can safely skip decryption for the returned data.
    // todo: Walk the include/select tree for a better decision.
    debug.decryption(
      `Skipping decryption: ${params.model} has no encrypted field and no connection was included`
    )
    return
  }

  debug.decryption('Raw result from database: %O', result)

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
        debug.decryption(
          `Decrypted ${model}.${field} at path \`${path}\` using key fingerprint ${decryptionKey.fingerprint}`
        )
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
    console.error(errors.decryptionErrorReport(operation, decryptionErrors))
  }
  if (fatalDecryptionErrors.length > 0) {
    throw new Error(
      errors.decryptionErrorReport(operation, fatalDecryptionErrors)
    )
  }
  debug.decryption('Decrypted result: %O', result)
}

function rewriteHashedFieldPath(
  path: string,
  field: string,
  hashField: string
) {
  const items = path.split('.').reverse()
  // Where clause
  if (items.includes('where') && items[0] === field) {
    items[0] = hashField
    return items.reverse().join('.')
  }
  if (items.includes('where') && items[1] === field && items[0] === 'equals') {
    items[1] = hashField
    return items.reverse().join('.')
  }
  // Connect clause
  if (items[1] === 'connect' && items[0] === field) {
    items[0] = hashField
    return items.reverse().join('.')
  }
  return null
}

function rewriteWritePath(path: string, field: string, hashField: string) {
  const items = path.split('.').reverse()
  if (items[0] === field) {
    items[0] = hashField
  } else if (items[0] === 'set' && items[1] === field) {
    items[1] = hashField
  }
  return items.reverse().join('.')
}

function isOrderBy(path: string, field: string, value: string) {
  const items = path.split('.').reverse()
  return (
    items[1] === 'orderBy' &&
    items[0] === field &&
    ['asc', 'desc'].includes(value.toLowerCase())
  )
}
