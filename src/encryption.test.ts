import { formatKey } from '@47ng/cloak/dist/key'
import { DMMFModels } from 'dmmf'
import { Configuration, MiddlewareParams } from './types'
import {
  configureFunctions,
  configureKeys,
  configureKeysAndFunctions,
  decryptOnRead,
  encryptOnWrite,
  getMethod,
  isCustomConfiguration,
  isDefaultConfiguration
} from './encryption'
import { errors } from './errors'

const ENCRYPTION_TEST_KEY =
  'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='
const DECRYPTION_TEST_KEYS = [
  'k1.aesgcm256.4BNYdJnjOQJP2adq9cGM9kb4dZxDujUs6aPS0VeRtAM=',
  'k1.aesgcm256.El9unG7WBAVRQdATOyMggE3XrLV2ZjTGKdajfmIeBPs='
]

const encryptFunction = jest.fn(
  (decripted: string) => `fake-encription-${decripted}`
)

const decryptFunction = jest.fn(
  (encrypted: string) => `fake-decription-${encrypted}`
)

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

  describe('configureKeysAndFunctions', () => {
    test('Should return keys === null ', () => {
      const config = {
        encryptFn: encryptFunction,
        decryptFn: decryptFunction
      }

      const result = configureKeysAndFunctions(config)

      expect(result.keys).toBeNull()
    })
  })

  describe('isDefaultConfiguration', () => {
    test('should be truthy', () => {
      const keysConfig = {
        decryptionKeys: DECRYPTION_TEST_KEYS,
        encryptionKey: ENCRYPTION_TEST_KEY
      }

      expect(isDefaultConfiguration(keysConfig)).toBeTruthy()
      expect(isDefaultConfiguration({})).toBeTruthy()
    })

    test('should be falsy', () => {
      const config = {
        decryptFn: decryptFunction,
        encryptFn: encryptFunction
      }

      const result = isDefaultConfiguration(config)

      expect(result).toBeFalsy()
    })
  })

  describe('isCustomConfiguration', () => {
    test('should be truthy', () => {
      const config = {
        decryptFn: decryptFunction,
        encryptFn: encryptFunction
      }

      const result = isCustomConfiguration(config)

      expect(result).toBeTruthy()
    })

    test('should be falsy', () => {
      const config = {
        decryptionKeys: DECRYPTION_TEST_KEYS,
        encryptionKey: ENCRYPTION_TEST_KEY
      }

      const result = isCustomConfiguration(config)

      expect(result).toBeFalsy()
    })
  })

  describe('getMethod', () => {
    test('Should throw error providing keys and cypher functions', () => {
      const config = {
        decryptFn: decryptFunction,
        encryptFn: encryptFunction,
        decryptionKeys: DECRYPTION_TEST_KEYS,
        encryptionKey: ENCRYPTION_TEST_KEY
      }

      const run = () => getMethod(config)

      expect(run).toThrowError(errors.invalidConfig)
    })

    test('Should return method === "CUSTOM"', () => {
      const config = {
        encryptFn: encryptFunction,
        decryptFn: decryptFunction
      }

      const result = getMethod(config)

      expect(result).toBe('CUSTOM')
    })

    test('Should return method === "DEFAULT" ', () => {
      const config = {
        decryptionKeys: DECRYPTION_TEST_KEYS,
        encryptionKey: ENCRYPTION_TEST_KEY
      }

      const result = getMethod(config)

      expect(result).toBe('DEFAULT')
    })
  })

  describe('configureFunctions', () => {
    test('Should throw error providing invalid cypher functions', () => {
      const config = {
        encryptFn: 'NOT A FUNCTION',
        decryptFn: 'STILL NOT A FUNCTION'
      }

      const run = () => configureFunctions(config)

      expect(run).toThrowError(errors.invalidFunctionsConfiguration)
    })
  })

  describe('encryptOnWrite', () => {
    test('Should call custom cypher encrypt function', async () => {
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

      const config: Configuration = {
        encryptFn: encryptFunction,
        decryptFn: () => 'fake-decryption'
      }

      const { keys, cipherFunctions, method } =
        configureKeysAndFunctions(config)

      encryptOnWrite(
        params,
        dmmfModels,
        'User.create',
        method,
        keys,
        cipherFunctions?.encryptFn
      )

      expect(encryptFunction).toBeCalledTimes(1)
      expect(encryptFunction).toBeCalledWith(name)
    })
  })

  describe('decryptOnRead', () => {
    test('Should call custom cypher decrypt function', async () => {
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

      const config: Configuration = {
        decryptFn: decryptFunction,
        encryptFn: () => 'encrypted-text'
      }

      const { keys, cipherFunctions, method } =
        configureKeysAndFunctions(config)

      const encryptedName = 'a1b2c3d4e5d6'
      const result = { name: encryptedName }

      decryptOnRead(
        params,
        result,
        dmmfModels,
        'User.findFirst',
        method,
        keys,
        cipherFunctions?.decryptFn
      )

      expect(decryptFunction).toBeCalledTimes(1)
      expect(decryptFunction).toBeCalledWith(encryptedName)
    })
  })
})
