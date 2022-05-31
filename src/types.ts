import { Prisma } from '@prisma/client'

// Prisma types --

export type MiddlewareParams = Prisma.MiddlewareParams
export type Middleware = Prisma.Middleware
export type DMMF = typeof Prisma.dmmf

// Internal types --

export type EncryptionFn = (value: string) => string

export type DecryptionFn = (value: string) => string

export type CipherFunctions = {
  encrypt: EncryptionFn
  decrypt: DecryptionFn
}

export interface Configuration {
  encryptionKey?: string
  decryptionKeys?: string[]
  cipher?: CipherFunctions
}

export interface FieldConfiguration {
  encrypt: boolean
  strictDecryption: boolean
}

export interface FieldMatcher {
  regexp: RegExp
  fieldConfig: FieldConfiguration
}
