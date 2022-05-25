import { Prisma } from '@prisma/client'

// Prisma types --

export type MiddlewareParams = Prisma.MiddlewareParams
export type Middleware = Prisma.Middleware
export type DMMF = typeof Prisma.dmmf

// Internal types --

export type EncryptionFunction = (value: string) => string

export type DecryptionFunction = (value: string) => string

export interface Configuration {
  encryptionKey?: string
  decryptionKeys?: string[]
  encryptionFn?: EncryptionFunction
  decryptionFn?: DecryptionFunction
}

export interface FieldConfiguration {
  encrypt: boolean
  strictDecryption: boolean
}

export interface FieldMatcher {
  regexp: RegExp
  fieldConfig: FieldConfiguration
}
