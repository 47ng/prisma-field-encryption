import { getDMMF } from '@prisma/sdk'
import { analyseDMMF } from './dmmf'
import type { MiddlewareParams } from './types'
import { visitInputTargetFields } from './visitor'

describe('visitor', () => {
  const dmmf = getDMMF({
    datamodel: `
      model User {
        id           Int     @id @default(autoincrement())
        email        String  @unique
        name         String? /// @encrypted
        posts        Post[]
        pinnedPost   Post?   @relation(fields: [pinnedPostId], references: [id], name: "pinnedPost")
        pinnedPostId Int?
      }

      model Post {
        id         Int        @id @default(autoincrement())
        title      String
        content    String? /// @encrypted
        author     User?      @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Cascade)
        authorId   Int?
        categories Category[]
        havePinned User[]     @relation("pinnedPost")
      }

      // Model without encrypted fields
      model Category {
        id    Int    @id @default(autoincrement())
        name  String
        posts Post[]
      }
    `
  })

  test('visitInputTargetFields - simple example', async () => {
    const models = analyseDMMF(await dmmf)
    const params: MiddlewareParams = {
      action: 'create',
      model: 'User',
      args: {
        email: '007@hmss.gov.uk',
        name: 'James Bond'
      },
      dataPath: [],
      runInTransaction: false
    }
    const visitor = jest.fn()
    visitInputTargetFields(params, models, visitor)
    expect(visitor).toHaveBeenCalledTimes(1)
    expect(visitor).toHaveBeenCalledWith({
      path: 'name',
      value: 'James Bond',
      model: 'User',
      field: 'name',
      fieldConfig: {
        encrypt: true,
        strictDecryption: false
      }
    })
  })

  test('visitInputTargetFields - nested create', async () => {
    const models = analyseDMMF(await dmmf)
    const params: MiddlewareParams = {
      action: 'create',
      model: 'User',
      args: {
        email: '007@hmss.gov.uk',
        name: 'James Bond',
        posts: {
          create: [
            {
              title: 'First report',
              content: 'Reporting for duty'
            },
            {
              title: 'Mission Briefing',
              content: 'Going after Spectre'
            }
          ]
        }
      },
      dataPath: [],
      runInTransaction: false
    }
    const visitor = jest.fn()
    visitInputTargetFields(params, models, visitor)
    expect(visitor).toHaveBeenCalledTimes(3)
    expect(visitor.mock.calls).toEqual([
      [
        {
          path: 'name',
          value: 'James Bond',
          model: 'User',
          field: 'name',
          fieldConfig: {
            encrypt: true,
            strictDecryption: false
          }
        }
      ],
      [
        {
          path: 'posts.create.0.content',
          value: 'Reporting for duty',
          model: 'Post',
          field: 'content',
          fieldConfig: {
            encrypt: true,
            strictDecryption: false
          }
        }
      ],
      [
        {
          path: 'posts.create.1.content',
          value: 'Going after Spectre',
          model: 'Post',
          field: 'content',
          fieldConfig: {
            encrypt: true,
            strictDecryption: false
          }
        }
      ]
    ])
  })
})
