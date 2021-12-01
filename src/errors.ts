import { Prisma } from '@prisma/client'

const header = '[prisma-field-encryption]'

const prefixError = (input: string) => `${header} Error: ${input}`
const prefixWarning = (input: string) => `${header} Warning: ${input}`

export const errors = {
  // Setup errors
  noEncryptionKey: prefixError('no encryption key provided.'),
  unsupportedFieldType: (model: Prisma.DMMF.Model, field: Prisma.DMMF.Field) =>
    prefixError(
      `encryption enabled on unsupported ${field.type} field ${model.name}.${field.name}. Only String fields can be encrypted.`
    ),

  // Runtime errors
  fieldEncryptionError: (
    model: string,
    field: string,
    path: string,
    error: any
  ) => `Encryption error for ${model}.${field} at ${path}: ${error}`,

  encryptionErrorReport: (operation: string, errors: string[]) =>
    prefixError(`encryption error(s) encountered in operation ${operation}:
  ${errors.join('\n  ')}`),

  fieldDecryptionError: (
    model: string,
    field: string,
    path: string,
    error: any
  ) => `Decryption error for ${model}.${field} at ${path}: ${error}`,

  decryptionErrorReport: (operation: string, errors: string[]) =>
    prefixError(`decryption error(s) encountered in operation ${operation}:
  ${errors.join('\n  ')}`)
}

export const warnings = {
  // Setup warnings
  strictAndReadonlyAnnotation: (model: string, field: string) =>
    prefixWarning(
      `the field ${model}.${field} defines both 'strict' and 'readonly'.
Strict decryption is disabled in read-only mode (to handle new unencrypted data).`
    ),

  // Runtime warnings
  whereClause: (operation: string, path: string) =>
    prefixWarning(`you're using an encrypted field in a \`where\` clause.
  -> In ${operation}: ${path}
  This will not work, read more: https://github.com/47ng/prisma-field-encryption#caveats--limitations`)
}
