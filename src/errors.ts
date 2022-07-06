import { namespace } from './debugger'
import type { DMMFField, DMMFModel } from './types'

const error = `[${namespace}] Error`
const warning = `[${namespace}] Warning`

export const errors = {
  // Setup errors
  noEncryptionKey: `${error}: no encryption key provided.`,
  unsupportedFieldType: (model: DMMFModel, field: DMMFField) =>
    `${error}: encryption enabled for field ${model.name}.${field.name} of unsupported type ${field.type}: only String fields can be encrypted.`,
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
  Read more: https://github.com/47ng/prisma-field-encryption#custom-cursors`,
  noInteractiveTransactions: `${error}: this generator requires enabling the \`interactiveTransactions\` preview feature on \`prisma-client-js\`:

  generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["interactiveTransactions"] // <- Add this line
  }

  Read more: https://github.com/47ng/prisma-field-encryption#migrations
`
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
  whereClause: (operation: string, path: string) =>
    `${warning}: you're using an encrypted field in a \`where\` clause.
  -> In ${operation}: ${path}
  This will not work, read more: https://github.com/47ng/prisma-field-encryption#caveats--limitations`
}
