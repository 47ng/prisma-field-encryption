import { formatKey } from '@47ng/cloak/dist/key'
import { DMMFModels } from 'dmmf'
import { MiddlewareParams } from 'types'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import { errors } from './errors'

const ENCRYPTION_TEST_KEY =
  'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='
const DECRYPTION_TEST_KEYS = [
  'k1.aesgcm256.4BNYdJnjOQJP2adq9cGM9kb4dZxDujUs6aPS0VeRtAM=',
  'k1.aesgcm256.El9unG7WBAVRQdATOyMggE3XrLV2ZjTGKdajfmIeBPs='
]

describe('encryption', () => {
  describe('configureKeys', () => {
    test('No encryption key specified', () => {
      const run = () => configureKeys({})
      expect(run).toThrowError(errors.noEncryptionKey)
    })

    test('Providing encryptionKey directly', () => {
      const { encryptionKey } = configureKeys({
        encryptionKey: ENCRYPTION_TEST_KEY
      })

      expect(formatKey(encryptionKey.raw as Uint8Array)).toEqual(
        ENCRYPTION_TEST_KEY
      )
    })

    test('Providing encryptionKey via the environment', () => {
      process.env.PRISMA_FIELD_ENCRYPTION_KEY = ENCRYPTION_TEST_KEY
      const { encryptionKey } = configureKeys({})
      expect(formatKey(encryptionKey.raw as Uint8Array)).toEqual(
        ENCRYPTION_TEST_KEY
      )
      process.env.PRISMA_FIELD_ENCRYPTION_KEY = undefined
    })

    test('Encryption key is in the keychain', () => {
      const { encryptionKey, keychain } = configureKeys({
        encryptionKey: ENCRYPTION_TEST_KEY
      })
      expect(keychain[encryptionKey.fingerprint].key).toEqual(encryptionKey)
    })

    test('Loading decryption keys directly', () => {
      const { keychain } = configureKeys({
        encryptionKey: ENCRYPTION_TEST_KEY,
        decryptionKeys: DECRYPTION_TEST_KEYS
      })
      expect(Object.values(keychain).length).toEqual(3)
    })

    test('Loading decryption keys via the environment', () => {
      process.env.PRISMA_FIELD_DECRYPTION_KEYS = DECRYPTION_TEST_KEYS.join(',')

      const { keychain } = configureKeys({
        encryptionKey: ENCRYPTION_TEST_KEY
      })
      expect(Object.values(keychain).length).toEqual(3)
      process.env.PRISMA_FIELD_DECRYPTION_KEYS = undefined
    })
  })

  describe('encryptOnWrite', () => {
    test('Should call custom encrypt function', async () => {
      const encryptFunction = jest.fn(
        (decripted: string) => `fake-encription-${decripted}`
      )

      const name = 'value'
      const params: MiddlewareParams = {
        model: 'User',
        action: 'create',
        args: { data: { name } },
        runInTransaction: true,
        dataPath: ['any']
      }

      const dmmfModels: DMMFModels = {
        User: {
          connections: {
            'fake-connection': {
              modelName: 'User',
              isList: false
            }
          },
          fields: {
            name: {
              encrypt: true,
              strictDecryption: false
            }
          }
        }
      }

      const keys = configureKeys({
        encryptionKey: ENCRYPTION_TEST_KEY,
        decryptionKeys: DECRYPTION_TEST_KEYS
      })

      encryptOnWrite(params, keys, dmmfModels, 'User.create', encryptFunction)

      expect(encryptFunction).toBeCalledTimes(1)
      expect(encryptFunction).toBeCalledWith(name)
    })
  })

  describe('decryptOnRead', () => {
    test('Should call custom decryp function', async () => {
      const decryptFunction = jest.fn(
        (encrypted: string) => `fake-encription-${encrypted}`
      )

      const params: MiddlewareParams = {
        model: 'User',
        action: 'findFirst',
        args: { where: { name: 'value' } },
        runInTransaction: true,
        dataPath: ['any']
      }

      const dmmfModels: DMMFModels = {
        User: {
          connections: {
            'fake-connection': {
              modelName: 'User',
              isList: false
            }
          },
          fields: {
            name: {
              encrypt: true,
              strictDecryption: false
            }
          }
        }
      }

      const keys = configureKeys({
        encryptionKey: ENCRYPTION_TEST_KEY,
        decryptionKeys: DECRYPTION_TEST_KEYS
      })

      const encryptedName = 'a1b2c3d4e5d6'
      const result = { name: encryptedName }

      decryptOnRead(
        params,
        result,
        keys,
        dmmfModels,
        'User.findFirst',
        decryptFunction
      )

      expect(decryptFunction).toBeCalledTimes(1)
      expect(decryptFunction).toBeCalledWith(encryptedName)
    })
  })
})
