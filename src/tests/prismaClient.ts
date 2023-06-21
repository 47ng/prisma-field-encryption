import { fieldEncryptionExtension, fieldEncryptionMiddleware } from '../index'
import { Configuration } from '../types'
import { Prisma, PrismaClient } from './.generated/client'

const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.__________________________________________8='

const config: Configuration = {
  encryptionKey: TEST_ENCRYPTION_KEY,
  dmmf: Prisma.dmmf
}

const useMiddleware = Boolean(process.env.USE_MIDDLEWARE)

const globalClient = new PrismaClient()

const extendedClient = globalClient.$extends(
  fieldEncryptionExtension(config)
) as PrismaClient // <- Type annotation needed for internals only

if (useMiddleware) {
  globalClient.$use(fieldEncryptionMiddleware(config))
}

export const client = useMiddleware ? globalClient : extendedClient
