import { fieldEncryptionExtension, fieldEncryptionMiddleware } from '../index'
import { Configuration } from '../types'
import { Prisma, PrismaClient } from './.generated/client'

const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.__________________________________________8='

const config: Configuration = {
  encryptionKey: TEST_ENCRYPTION_KEY,
  dmmf: Prisma.dmmf
}

export function makeMiddlewareClient() {
  const client = new PrismaClient()
  client.$use(fieldEncryptionMiddleware(config))
  return client
}

export function makeExtensionClient() {
  const client = new PrismaClient()
  return client.$extends(fieldEncryptionExtension(config)) as PrismaClient
}
