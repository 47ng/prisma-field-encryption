import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { analyseSchema, analyseSchemaFile } from './ast'
import type { DMMFModels } from './dmmf'
import { HashFieldNormalizeOptions } from './types'

describe('ast', () => {
  test('analyseSchema - basic schema with encrypted fields', () => {
    const schema = `
      model User {
        id           Int     @id @default(autoincrement())
        email        String  @unique
        name         String? /// @encrypted
        nameHash     String? /// @encryption:hash(name)?normalize=lowercase
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

    const received = analyseSchema(schema)
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

  test('analyseSchema - strict mode', () => {
    const schema = `
      model Secret {
        id    Int    @id @default(autoincrement())
        value String /// @encrypted?mode=strict
      }
    `
    const result = analyseSchema(schema)
    expect(result.Secret.fields.value.encrypt).toBe(true)
    expect(result.Secret.fields.value.strictDecryption).toBe(true)
  })

  test('analyseSchema - readonly mode', () => {
    const schema = `
      model Legacy {
        id    Int    @id @default(autoincrement())
        value String /// @encrypted?mode=readonly
      }
    `
    const result = analyseSchema(schema)
    expect(result.Legacy.fields.value.encrypt).toBe(false)
    expect(result.Legacy.fields.value.strictDecryption).toBe(false)
  })

  test('analyseSchema - multiple encrypted fields', () => {
    const schema = `
      model Sensitive {
        id      Int    @id @default(autoincrement())
        secret1 String /// @encrypted
        secret2 String /// @encrypted?mode=strict
        public  String
      }
    `
    const result = analyseSchema(schema)
    expect(Object.keys(result.Sensitive.fields)).toEqual(['secret1', 'secret2'])
    expect(result.Sensitive.fields.secret1.encrypt).toBe(true)
    expect(result.Sensitive.fields.secret2.strictDecryption).toBe(true)
  })

  test('analyseSchema - throws on non-String encrypted field', () => {
    const schema = `
      model Bad {
        id    Int @id @default(autoincrement())
        value Int /// @encrypted
      }
    `
    expect(() => analyseSchema(schema)).toThrow(/unsupported type/)
  })

  test('analyseSchema - throws on non-unique cursor', () => {
    const schema = `
      model Bad {
        id     Int    @id @default(autoincrement())
        cursor String /// @encryption:cursor
        value  String /// @encrypted
      }
    `
    expect(() => analyseSchema(schema)).toThrow(/should have a @unique/)
  })

  test('analyseSchema - throws on encrypted cursor', () => {
    const schema = `
      model Bad {
        id     Int    @id @default(autoincrement())
        cursor String @unique /// @encrypted @encryption:cursor
        value  String /// @encrypted
      }
    `
    expect(() => analyseSchema(schema)).toThrow(/cannot be used as a cursor/)
  })

  test('analyseSchema - BigInt cursor', () => {
    const schema = `
      model BigIntModel {
        id    BigInt @id
        value String /// @encrypted
      }
    `
    const result = analyseSchema(schema)
    expect(result.BigIntModel.cursor).toBe('id')
  })

  test('analyseSchema - hash with full options', () => {
    const schema = `
      model Hashed {
        id        Int    @id @default(autoincrement())
        email     String /// @encrypted
        emailHash String /// @encryption:hash(email)?algorithm=sha512&inputEncoding=utf8&outputEncoding=base64
      }
    `
    const result = analyseSchema(schema)
    expect(result.Hashed.fields.email.hash).toEqual({
      targetField: 'emailHash',
      algorithm: 'sha512',
      inputEncoding: 'utf8',
      outputEncoding: 'base64',
      normalize: []
    })
  })

  test('analyseSchema - model with no id and no unique field', () => {
    const schema = `
      model NoId {
        name  String /// @encrypted
        value String
      }
    `
    // Should warn but not throw
    const result = analyseSchema(schema)
    expect(result.NoId.cursor).toBeUndefined()
  })

  test('analyseSchemaFile - reads from file', () => {
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma')
    const result = analyseSchemaFile(schemaPath)

    // Verify it parses the actual project schema
    expect(result.User).toBeDefined()
    expect(result.User.fields.name).toBeDefined()
    expect(result.User.fields.name.encrypt).toBe(true)
    expect(result.Post).toBeDefined()
    expect(result.Post.fields.content).toBeDefined()
  })

  test('analyseSchema - produces same output as analyseDMMF for matching schema', async () => {
    // This test verifies AST output matches DMMF output for the same schema
    const { getDMMF } = await import('@prisma/internals')
    const schema = `
      model User {
        id           Int     @id @default(autoincrement())
        email        String  @unique
        name         String? /// @encrypted
        nameHash     String? /// @encryption:hash(name)?normalize=lowercase
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

      model Category {
        id    Int    @id @default(autoincrement())
        name  String
        posts Post[]
      }

      model Unique {
        id     Json   @id
        unique String @unique
      }
    `

    const { analyseDMMF } = await import('./dmmf')
    const dmmf = await getDMMF({ datamodel: schema })
    const dmmfResult = analyseDMMF(dmmf)
    const astResult = analyseSchema(schema)

    expect(astResult).toEqual(dmmfResult)
  })

  // Multi-file schema tests
  describe('multi-file schema support', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'))
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('analyseSchemaFile - reads directory with multiple .prisma files', () => {
      // Simulate a multi-file schema setup
      const schemaFile = path.join(tmpDir, 'schema.prisma')
      const userFile = path.join(tmpDir, 'user.prisma')
      const postFile = path.join(tmpDir, 'post.prisma')

      fs.writeFileSync(
        schemaFile,
        `
        datasource db {
          provider = "sqlite"
          url      = "file:./dev.db"
        }

        generator client {
          provider = "prisma-client-js"
        }
      `
      )

      fs.writeFileSync(
        userFile,
        `
        model User {
          id    Int    @id @default(autoincrement())
          email String @unique
          name  String /// @encrypted
          posts Post[]
        }
      `
      )

      fs.writeFileSync(
        postFile,
        `
        model Post {
          id       Int    @id @default(autoincrement())
          title    String
          content  String /// @encrypted
          author   User?  @relation(fields: [authorId], references: [id])
          authorId Int?
        }
      `
      )

      // Pass directory path instead of file path
      const result = analyseSchemaFile(tmpDir)

      expect(result.User).toBeDefined()
      expect(result.User.fields.name).toBeDefined()
      expect(result.User.fields.name.encrypt).toBe(true)
      expect(result.User.connections.posts).toEqual({
        modelName: 'Post',
        isList: true
      })

      expect(result.Post).toBeDefined()
      expect(result.Post.fields.content).toBeDefined()
      expect(result.Post.fields.content.encrypt).toBe(true)
      expect(result.Post.connections.author).toEqual({
        modelName: 'User',
        isList: false
      })
    })

    test('analyseSchemaFile - reads nested subdirectories', () => {
      // Simulate a multi-file schema with subdirectories
      const modelsDir = path.join(tmpDir, 'models')
      fs.mkdirSync(modelsDir)

      fs.writeFileSync(
        path.join(tmpDir, 'schema.prisma'),
        `
        datasource db {
          provider = "sqlite"
          url      = "file:./dev.db"
        }
      `
      )

      fs.writeFileSync(
        path.join(modelsDir, 'user.prisma'),
        `
        model User {
          id    Int    @id @default(autoincrement())
          name  String /// @encrypted
        }
      `
      )

      fs.writeFileSync(
        path.join(modelsDir, 'post.prisma'),
        `
        model Post {
          id      Int    @id @default(autoincrement())
          content String /// @encrypted
          author  User?  @relation(fields: [authorId], references: [id])
          authorId Int?
        }
      `
      )

      const result = analyseSchemaFile(tmpDir)

      expect(result.User).toBeDefined()
      expect(result.User.fields.name.encrypt).toBe(true)
      expect(result.Post).toBeDefined()
      expect(result.Post.fields.content.encrypt).toBe(true)
      // Cross-file connection should resolve
      expect(result.Post.connections.author).toEqual({
        modelName: 'User',
        isList: false
      })
    })

    test('analyseSchemaFile - skips migrations directory', () => {
      const migrationsDir = path.join(tmpDir, 'migrations')
      fs.mkdirSync(migrationsDir)

      fs.writeFileSync(
        path.join(tmpDir, 'schema.prisma'),
        `
        model User {
          id   Int    @id @default(autoincrement())
          name String /// @encrypted
        }
      `
      )

      // This file in migrations/ should be ignored
      fs.writeFileSync(
        path.join(migrationsDir, 'old.prisma'),
        `
        model OldModel {
          id    Int    @id @default(autoincrement())
          value String /// @encrypted
        }
      `
      )

      const result = analyseSchemaFile(tmpDir)

      expect(result.User).toBeDefined()
      expect(result.OldModel).toBeUndefined()
    })

    test('analyseSchemaFile - throws when directory has no .prisma files', () => {
      const emptyDir = path.join(tmpDir, 'empty')
      fs.mkdirSync(emptyDir)

      expect(() => analyseSchemaFile(emptyDir)).toThrow(
        /No .prisma files found/
      )
    })

    test('analyseSchemaFile - models across files can reference each other', () => {
      // This is the core multi-file schema test - models in separate files
      // must be able to reference each other for connections
      fs.writeFileSync(
        path.join(tmpDir, 'user.prisma'),
        `
        model User {
          id       Int       @id @default(autoincrement())
          name     String    /// @encrypted
          posts    Post[]
          comments Comment[]
        }
      `
      )

      fs.writeFileSync(
        path.join(tmpDir, 'post.prisma'),
        `
        model Post {
          id       Int       @id @default(autoincrement())
          content  String    /// @encrypted
          author   User      @relation(fields: [authorId], references: [id])
          authorId Int
          comments Comment[]
        }
      `
      )

      fs.writeFileSync(
        path.join(tmpDir, 'comment.prisma'),
        `
        model Comment {
          id       Int    @id @default(autoincrement())
          text     String /// @encrypted
          post     Post   @relation(fields: [postId], references: [id])
          postId   Int
          author   User   @relation(fields: [authorId], references: [id])
          authorId Int
        }
      `
      )

      const result = analyseSchemaFile(tmpDir)

      // All three models should be found
      expect(result.User).toBeDefined()
      expect(result.Post).toBeDefined()
      expect(result.Comment).toBeDefined()

      // Cross-file connections should all resolve
      expect(result.User.connections.posts).toEqual({
        modelName: 'Post',
        isList: true
      })
      expect(result.User.connections.comments).toEqual({
        modelName: 'Comment',
        isList: true
      })
      expect(result.Post.connections.author).toEqual({
        modelName: 'User',
        isList: false
      })
      expect(result.Post.connections.comments).toEqual({
        modelName: 'Comment',
        isList: true
      })
      expect(result.Comment.connections.post).toEqual({
        modelName: 'Post',
        isList: false
      })
      expect(result.Comment.connections.author).toEqual({
        modelName: 'User',
        isList: false
      })

      // All encrypted fields should be detected
      expect(result.User.fields.name.encrypt).toBe(true)
      expect(result.Post.fields.content.encrypt).toBe(true)
      expect(result.Comment.fields.text.encrypt).toBe(true)
    })
  })
})
