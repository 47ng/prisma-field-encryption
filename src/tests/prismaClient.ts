import { PrismaClient } from '@prisma/client'
import { fieldEncryptionMiddleware } from '../index'

export const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.OsqVmAOZBB_WW3073q1wU4ag0ap0ETYAYMh041RuxuI='

export const client = new PrismaClient()

client.$use(
  fieldEncryptionMiddleware({
    encryptionKey: TEST_ENCRYPTION_KEY
  })
)
client.$use(async (params, next) => {
  console.dir({ _: 'watcher:pre', params }, { depth: Infinity })
  const result = await next(params)
  console.dir({ _: 'watcher:post', result }, { depth: Infinity })
  return result
})
