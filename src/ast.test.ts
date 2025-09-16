import {
  analyseSchema,
  ASTModels,
  parseEncryptedAnnotation,
  parseHashAnnotation
} from './ast'
import { HashFieldNormalizeOptions } from './types'

describe('ast', () => {
  describe('parseEncryptedAnnotation', () => {
    test('no annotation at all', () => {
      const received = parseEncryptedAnnotation()
      const expected = null
      expect(received).toEqual(expected)
    })

    test('no @encrypted keyword', () => {
      const received = parseEncryptedAnnotation('not encrypted')
      const expected = null
      expect(received).toEqual(expected)
    })

    test('@encrypted keyword alone', () => {
      const received = parseEncryptedAnnotation(' pre @encrypted post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?with=junk', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?with=junk post '
      )
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('<deprecated> @encrypted?strict', () => {
      const received = parseEncryptedAnnotation(' pre @encrypted?strict post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(true)
    })

    test('<deprecated> @encrypted?readonly', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?readonly post '
      )
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?mode=default', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?mode=default post '
      )
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?mode=strict', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?mode=strict post '
      )
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(true)
    })

    test('@encrypted?mode=readonly', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?mode=readonly post '
      )
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })
  })

  describe('parseHashAnnotation', () => {
    test('returns null when no annotation found', () => {
      const received = parseHashAnnotation('no annotation')
      expect(received).toBeNull()
    })

    test('parses basic hash annotation', () => {
      const received = parseHashAnnotation('@encryption:hash(sourceField)')
      expect(received).toEqual({
        sourceField: 'sourceField',
        targetField: 'sourceFieldHash',
        algorithm: 'sha256',
        salt: undefined,
        inputEncoding: 'utf8',
        outputEncoding: 'hex',
        normalize: []
      })
    })

    test('parses hash annotation with custom parameters', () => {
      const received = parseHashAnnotation(
        '@encryption:hash(name)?algorithm=sha512&inputEncoding=utf8&outputEncoding=base64&normalize=lowercase&normalize=trim&salt=mysalt'
      )
      expect(received).toEqual({
        sourceField: 'name',
        targetField: 'nameHash',
        algorithm: 'sha512',
        salt: 'mysalt',
        inputEncoding: 'utf8',
        outputEncoding: 'base64',
        normalize: ['lowercase', 'trim']
      })
    })

    test('parses hash annotation with saltEnv parameter', () => {
      process.env.MY_SALT_ENV = 'test-salt-value'
      const received = parseHashAnnotation(
        '@encryption:hash(name)?saltEnv=MY_SALT_ENV'
      )
      expect(received).toEqual({
        sourceField: 'name',
        targetField: 'nameHash',
        algorithm: 'sha256',
        salt: 'test-salt-value',
        inputEncoding: 'utf8',
        outputEncoding: 'hex',
        normalize: []
      })
      delete process.env.MY_SALT_ENV
    })
  })

  describe('analysePrismaSchema', () => {
    test('analyzes a complete Prisma schema', () => {
      const schema = `
        model User {
          id           Int     @id @default(autoincrement())
          email        String  @unique
          name         String? @unique /// @encrypted
          nameHash     String? @unique /// @encryption:hash(name)?normalize=lowercase
          posts        Post[]
          pinnedPost   Post?   @relation(fields: [pinnedPostId], references: [id], name: "pinnedPost")
          pinnedPostId Int?
        }

        model Post {
          id         Int        @id @default(autoincrement())
          cursor     String     @unique /// @encryption:cursor
          title      String
          content    String? /// @encrypted
          published  Boolean    @default(false)
          author     User?      @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Cascade)
          authorId   Int?
          categories Category[]
          havePinned User[]     @relation("pinnedPost")
        }

        model Category {
          id    Int    @id @default(autoincrement())
          name  String
          posts Post[]
        }

        model Unique {
          id     Json   @id // invalid type for iteration
          unique String @unique
        }
      `
      
      const received = analyseSchema(schema)
      const expected: ASTModels = {
        User: {
          fields: {
            name: {
              encrypt: true,
              strictDecryption: false,
              hash: {
                targetField: 'nameHash',
                algorithm: 'sha256',
                inputEncoding: 'utf8',
                outputEncoding: 'hex',
                normalize: [HashFieldNormalizeOptions.lowercase]
              }
            }
          },
          connections: {
            posts: { modelName: 'Post', isList: true },
            pinnedPost: { modelName: 'Post', isList: false }
          },
          cursor: 'id'
        },
        Post: {
          fields: {
            content: { encrypt: true, strictDecryption: false }
          },
          connections: {
            author: { modelName: 'User', isList: false },
            categories: { modelName: 'Category', isList: true },
            havePinned: { modelName: 'User', isList: true }
          },
          cursor: 'cursor'
        },
        Category: {
          fields: {},
          connections: {
            posts: { modelName: 'Post', isList: true }
          },
          cursor: 'id'
        },
        Unique: {
          fields: {},
          connections: {},
          cursor: 'unique'
        }
      }
      expect(received).toEqual(expected)
    })
  })
})
