import { Prisma, PrismaClient } from '@prisma/client'
import { fieldEncryptionMiddleware } from '..'

export const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.OsqVmAOZBB_WW3073q1wU4ag0ap0ETYAYMh041RuxuI='

export const logger =
  process.env.PRISMA_FIELD_ENCRYPTION_LOG === 'true'
    ? console
    : {
        log: (_args: any) => {},
        info: (_args: any) => {},
        dir: (_args: any) => {},
        error: console.error, // Still log errors
        warn: console.warn // and warnings
      }

export const defaultMiddleware = fieldEncryptionMiddleware({
  encryptionKey: TEST_ENCRYPTION_KEY
})

export const CIPHER = 'ABC#789*_CBA'
export const customMiddleware = fieldEncryptionMiddleware({
  encryptFn: value => `${value}${CIPHER}`,
  decryptFn: value => value.replace(CIPHER, '')
})

export function createClient(middleware: Prisma.Middleware): PrismaClient {
  const client = new PrismaClient()

  client.$use(async (params, next) => {
    const operation = `${params.model}.${params.action}`
    logger.dir(
      { '👀': `${operation}: before encryption`, params },
      { depth: null }
    )
    const result = await next(params)
    logger.dir(
      { '👀': `${operation}: after decryption`, result },
      { depth: null }
    )
    return result
  })

  client.$use(middleware)

  client.$use(async (params, next) => {
    const operation = `${params.model}.${params.action}`
    logger.dir(
      { '👀': `${operation}: sent to database`, params },
      { depth: null }
    )
    const result = await next(params)
    logger.dir(
      { '👀': `${operation}: received from database`, result },
      { depth: null }
    )
    return result
  })

  return client
}
