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
const useExtensions = Boolean(process.env.USE_EXTENSIONS)

const globalClient = new PrismaClient()

if (useMiddleware) {
  globalClient.$use(fieldEncryptionMiddleware(config))
}

const extendedClient = globalClient.$extends(
  fieldEncryptionExtension(config)
) as PrismaClient // <- Type annotation needed for internals only

export const client = useExtensions ? extendedClient : globalClient
