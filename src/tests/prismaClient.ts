import { fieldEncryptionMiddleware } from '../index'
import { Prisma, PrismaClient } from './.generated/client'

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

export const client = new PrismaClient()

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

client.$use(
  fieldEncryptionMiddleware({
    encryptionKey: TEST_ENCRYPTION_KEY,
    dmmf: Prisma.dmmf
  })
)

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
