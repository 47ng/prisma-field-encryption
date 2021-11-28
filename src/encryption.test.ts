import { formatKey } from '@47ng/cloak/dist/key'
import { configureKeys } from './encryption'

const TEST_KEY = 'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='

describe('encryption', () => {
  describe('configureKeys', () => {
    test('No encryption key specified', () => {
      const run = () => configureKeys({})
      expect(run).toThrowError(/No encryption key provided/)
    })

    test('Providing encryptionKey directly', () => {
      const { encryptionKey } = configureKeys({
        encryptionKey: TEST_KEY
      })
      expect(formatKey(encryptionKey.raw as Uint8Array)).toEqual(TEST_KEY)
    })

    test('Providing encryptionKey via the environment', () => {
      process.env.PRISMA_FIELD_ENCRYPTION_KEY = TEST_KEY
      const { encryptionKey } = configureKeys({})
      expect(formatKey(encryptionKey.raw as Uint8Array)).toEqual(TEST_KEY)
      process.env.PRISMA_FIELD_ENCRYPTION_KEY = undefined
    })

    test('Encryption key is in the keychain', () => {
      const { encryptionKey, keychain } = configureKeys({
        encryptionKey: TEST_KEY
      })
      expect(keychain[encryptionKey.fingerprint].key).toEqual(encryptionKey)
    })

    test('Loading decryption keys directly', () => {
      const { keychain } = configureKeys({
        encryptionKey: TEST_KEY,
        decryptionKeys: [
          'k1.aesgcm256.4BNYdJnjOQJP2adq9cGM9kb4dZxDujUs6aPS0VeRtAM=',
          'k1.aesgcm256.El9unG7WBAVRQdATOyMggE3XrLV2ZjTGKdajfmIeBPs='
        ]
      })
      expect(Object.values(keychain).length).toEqual(3)
    })

    test('Loading decryption keys via the environment', () => {
      process.env.PRISMA_FIELD_DECRYPTION_KEYS = [
        'k1.aesgcm256.4BNYdJnjOQJP2adq9cGM9kb4dZxDujUs6aPS0VeRtAM=',
        'k1.aesgcm256.El9unG7WBAVRQdATOyMggE3XrLV2ZjTGKdajfmIeBPs='
      ].join(',')

      const { keychain } = configureKeys({
        encryptionKey: TEST_KEY
      })
      expect(Object.values(keychain).length).toEqual(3)
      process.env.PRISMA_FIELD_DECRYPTION_KEYS = undefined
    })
  })
})
