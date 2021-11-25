// @ts-ignore
import { Prisma } from '@prisma/client'

// Prisma types --

export type MiddlewareParams = Prisma.MiddlewareParams
export type Middleware = Prisma.Middleware

// export interface MiddlewareParams<Models, Actions> {
//   model?: Models
//   action: Actions
//   args: any
//   dataPath: string[]
//   runInTransaction: boolean
// }

// Internal types --

export interface Configuration {
  encryptionKey?: string
  decryptionKeys?: string[]
}

export type FieldsConfiguration = Record<string, boolean>

// export type Middleware<Models, Actions> = (
//   params: MiddlewareParams<Models, Actions>,
//   next: (params: MiddlewareParams<Models, Actions>) => Promise<any>
// ) => Promise<any>
