import { getDMMF } from '@prisma/internals'
import {
  analyseDMMF,
  DMMFModels,
  parseEncryptedAnnotation,
  parseHashAnnotation
} from './dmmf'
import { HashFieldSanitizeOptions } from './types'

describe('dmmf', () => {
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

    test('<deprecated> readonly takes precedence over strict', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?strict&readonly post '
      )
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('unknown mode', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?mode=foo post '
      )
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('strict mode', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?mode=strict post '
      )
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(true)
    })

    test('readonly mode', () => {
      const received = parseEncryptedAnnotation(
        ' pre @encrypted?mode=readonly post '
      )
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })
  })

  describe('parseHashAnnotation', () => {
    test('no annotation at all', () => {
      const received = parseHashAnnotation()
      const expected = null
      expect(received).toEqual(expected)
    })

    test('missing field name', () => {
      const received = parseHashAnnotation('pre @encryption:hash post')
      const expected = null
      expect(received).toEqual(expected)
    })

    test('defaults', () => {
      const received = parseHashAnnotation(' pre @encryption:hash(foo) post ')
      expect(received!.sourceField).toEqual('foo')
      expect(received!.algorithm).toEqual('sha256')
      expect(received!.inputEncoding).toEqual('utf8')
      expect(received!.outputEncoding).toEqual('hex')
    })

    test('with options', () => {
      const received = parseHashAnnotation(
        ' pre @encryption:hash(foo)?algorithm=sha512&inputEncoding=base64&outputEncoding=base64 post'
      )
      expect(received!.sourceField).toEqual('foo')
      expect(received!.algorithm).toEqual('sha512')
      expect(received!.inputEncoding).toEqual('base64')
      expect(received!.outputEncoding).toEqual('base64')
    })
  })

  test('analyseDMMF', async () => {
    const dmmf = await getDMMF({
      datamodel: `
        model User {
          id           Int     @id @default(autoincrement())
          email        String  @unique
          name         String? /// @encrypted
          nameHash     String? /// @encryption:hash(name)?sanitize=lowercase
          posts        Post[]
          pinnedPost   Post?   @relation(fields: [pinnedPostId], references: [id], name: "pinnedPost")
          pinnedPostId Int?
        }

        model Post {
          id         Int        @id @default(autoincrement())
          title      String
          content    String?    /// @encrypted
          author     User?      @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Cascade)
          authorId   Int?
          cursor     Int        @unique /// @encryption:cursor
          categories Category[]
          havePinned User[]     @relation("pinnedPost")
        }

        // Model without encrypted fields
        model Category {
          id    Int    @id @default(autoincrement())
          name  String
          posts Post[]
        }

        // Cursor fallback on unique fields
        model Unique {
          id     Json   @id // invalid type for iteration
          unique String @unique
        }
      `
    })
    const received = analyseDMMF(dmmf)
    const expected: DMMFModels = {
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
              sanitize: [HashFieldSanitizeOptions.lowercase]
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
