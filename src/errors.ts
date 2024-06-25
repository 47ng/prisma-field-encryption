import { namespace } from './debugger'
import {
  HashFieldNormalizeOptions,
  type DMMFField,
  type DMMFModel
} from './types'

const error = `[${namespace}] Error`
const warning = `[${namespace}] Warning`

export const errors = {
  // Setup errors
  noEncryptionKey: `${error}: no encryption key provided.`,
  unsupportedFieldType: (model: DMMFModel, field: DMMFField) =>
    `${error}: encryption enabled for field ${model.name}.${field.name} of unsupported type ${field.type}: only String fields can be encrypted.`,
  unsupporteHashFieldType: (model: DMMFModel, field: DMMFField) =>
    `${error}: hash enabled for field ${model.name}.${field.name} of unsupported type ${field.type}: only String fields can contain hashes.`,
  hashSourceFieldNotFound: (
    model: DMMFModel,
    hashField: DMMFField,
    sourceField: string
  ) => `${error}: no such field \`${sourceField}\` in ${model.name}
  -> Referenced by hash field ${model.name}.${hashField.name}`,

  // Runtime errors
  fieldEncryptionError: (
    model: string,
    field: string,
    path: string,
    error: any
  ) => `Encryption error for ${model}.${field} at ${path}: ${error}`,

  encryptionErrorReport: (operation: string, errors: string[]) =>
    `${error}: encryption error(s) encountered in operation ${operation}:
  ${errors.join('\n  ')}`,

  fieldDecryptionError: (
    model: string,
    field: string,
    path: string,
    error: any
  ) => `Decryption error for ${model}.${field} at ${path}: ${error}`,

  decryptionErrorReport: (operation: string, errors: string[]) =>
    `${error}: decryption error(s) encountered in operation ${operation}:
  ${errors.join('\n  ')}`,

  orderByUnsupported: (
    model: string,
    field: string
  ) => `${error}: Running \`orderBy\` on encrypted field ${model}.${field} is not supported (results won't be sorted).
  See: https://github.com/47ng/prisma-field-encryption/issues/43
`,

  // Generator errors
  nonUniqueCursor: (model: string, field: string) =>
    `${error}: the cursor field ${model}.${field} should have a @unique attribute.
  Read more: https://github.com/47ng/prisma-field-encryption#custom-cursors`,
  unsupportedCursorType: (model: string, field: string, type: string) =>
    `${error}: the cursor field ${model}.${field} has an unsupported type ${type}.
  Only String and Int cursors are supported.
  Read more: https://github.com/47ng/prisma-field-encryption#custom-cursors`,
  encryptedCursor: (model: string, field: string) =>
    `${error}: the field ${model}.${field} cannot be used as a cursor as it is encrypted.
  Read more: https://github.com/47ng/prisma-field-encryption#custom-cursors`
}

export const warnings = {
  // Setup warnings
  deprecatedModeAnnotation: (
    model: string,
    field: string,
    mode: string
  ) => `${warning}: deprecated annotation \`/// @encrypted?${mode}\` on field ${model}.${field}.
  -> Please replace with /// @encrypted?mode=${mode}
  (support for undocumented annotations will be removed in a future update)`,
  unknownFieldModeAnnotation: (
    model: string,
    field: string,
    mode: string
  ) => `${warning}: the field ${model}.${field} defines an unknown mode \`${mode}\`.
  Accepted modes are \`strict\` or \`readonly\`.`,
  noCursorFound: (model: string) =>
    `${warning}: could not find a field to use to iterate over rows in model ${model}.
  Automatic encryption/decryption/key rotation migrations are disabled for this model.
  Read more: https://github.com/47ng/prisma-field-encryption#migrations`,

  // Runtime warnings
  whereConnectClauseNoHash: (operation: string, path: string) =>
    `${warning}: you're using an encrypted field in a \`where\` or \`connect\` clause without a hash.
  -> In ${operation}: ${path}
  This will not work as-is, read more: https://github.com/47ng/prisma-field-encryption#caveats--limitations
  Consider adding a hash field to enable searching encrypted fields:
  https://github.com/47ng/prisma-field-encryption#enable-search-with-hashes
  `,

  unsupportedHashAlgorithm: (
    model: string,
    field: string,
    algorithm: string
  ) => `${warning}: unsupported hash algorithm \`${algorithm}\` for hash field ${model}.${field}
  -> Valid values are algorithms accepted by Node's crypto.createHash:
  https://nodejs.org/dist/latest-v16.x/docs/api/crypto.html#cryptocreatehashalgorithm-options
`,
  unsupportedEncoding: (
    model: string,
    field: string,
    encoding: string,
    io: string
  ) => `${warning}: unsupported ${io} encoding \`${encoding}\` for hash field ${model}.${field}
  -> Valid values are utf8, base64, hex
`,
  unsupportedNormalize: (
    model: string,
    field: string,
    normalize: string
  ) => `${warning}: unsupported normalize \`${normalize}\` for hash field ${model}.${field}
  -> Valid values are ${Object.values(HashFieldNormalizeOptions)}
`,
  unsupportedNormalizeEncoding: (
    model: string,
    field: string,
    inputEncoding: string
  ) => `${warning}: unsupported normalize flag on field with encoding \`${inputEncoding}\` for hash field ${model}.${field}
-> Valid inputEncoding values for normalize are [utf8]
`
}
