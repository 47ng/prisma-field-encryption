import { fieldEncryptionExtension } from '../index'
import type { Configuration } from '../types'
import { Prisma, PrismaClient } from './.generated/client/index'

const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.__________________________________________8='

const config: Configuration = {
  encryptionKey: TEST_ENCRYPTION_KEY,
  dmmf: Prisma.dmmf
}

export function makeExtensionClient() {
  const client = new PrismaClient()
  return client.$extends(fieldEncryptionExtension(config)) as PrismaClient
}
