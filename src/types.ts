/**
 * Prisma types --
 *
 * We're copying just what we need for local type safety
 * without importing Prisma-generated types, as the location
 * of the generated client can be unknown (when using custom
 * or multiple client locations).
 */

import type { Encoding } from '@47ng/codec'
import { z } from 'zod'

/**
 * Not ideal to use `any` on model & action, but Prisma's
 * strong typing there actually prevents using the correct
 * type without excessive generics wizardry.
 */
export type MiddlewareParams<Models extends string, Actions extends string> = {
  model?: Models
  action: Actions
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

export type Middleware<
  Models extends string,
  Actions extends string,
  Result = any
> = (
  params: MiddlewareParams<Models, Actions>,
  next: (params: MiddlewareParams<Models, Actions>) => Promise<Result>
) => Promise<Result>

const dmmfFieldParser = z
  .object({
    name: z.string(),
    isList: z.boolean(),
    isUnique: z.boolean(),
    isId: z.boolean(),
    type: z.any(),
    documentation: z.string().optional()
  })
  .readonly()

const dmmfModelParser = z
  .object({
    name: z.string(),
    fields: z.array(dmmfFieldParser).readonly()
  })
  .readonly()

export const dmmfDocumentParser = z
  .object({
    datamodel: z
      .object({
        models: z.array(dmmfModelParser).readonly(),
        types:  z.array(dmmfModelParser).readonly()
      })
      .readonly()
  })
  .readonly()

export type DMMFModel = z.TypeOf<typeof dmmfModelParser>
export type DMMFField = z.TypeOf<typeof dmmfFieldParser>
export type DMMFDocument = z.TypeOf<typeof dmmfDocumentParser>

// Internal types --

export interface Configuration {
  encryptionKey?: string
  decryptionKeys?: string[]
  dmmf?: Readonly<DMMFDocument>
}

export type HashFieldConfiguration = {
  sourceField: string
  targetField: string
  algorithm: string
  salt?: string
  inputEncoding: Encoding
  outputEncoding: Encoding
  normalize?: HashFieldNormalizeOptions[]
}

export enum HashFieldNormalizeOptions {
  lowercase = 'lowercase',
  uppercase = 'uppercase',
  trim = 'trim',
  spaces = 'spaces',
  diacritics = 'diacritics'
}

export interface FieldConfiguration {
  encrypt: boolean
  strictDecryption: boolean
  hash?: Omit<HashFieldConfiguration, 'sourceField'>
}
