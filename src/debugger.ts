import Debug from 'debug'

export const namespace = 'prisma-field-encryption'

export const debug = {
  setup: Debug(`${namespace}:setup`),
  runtime: Debug(`${namespace}:runtime`),
  encryption: Debug(`${namespace}:encryption`),
  decryption: Debug(`${namespace}:decryption`)
}
