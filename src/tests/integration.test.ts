import { cloakedStringRegex } from '@47ng/cloak'
import {
  createClient,
  defaultMiddleware,
  customMiddleware,
  CIPHER
} from './prismaClient'
import * as sqlite from './sqlite'

describe('integration', () => {
  describe('Default configuration', () => {
    const email = '007@hmss.gov.uk'
    const client = createClient(defaultMiddleware)

    test('create user', async () => {
      const received = await client.user.create({
        data: {
          email,
          name: 'James Bond'
        }
      })
      const dbValue = await sqlite.get({ table: 'User', where: { email } })
      expect(received.name).toEqual('James Bond') // clear text in returned value
      expect(dbValue.name).toMatch(cloakedStringRegex) // encrypted in database
    })

    test('delete user', async () => {
      const received = await client.user.delete({ where: { email } })
      expect(received.name).toEqual('James Bond')
    })

    test('create post & associated user', async () => {
      const received = await client.post.create({
        data: {
          title: "I'm back",
          content: 'You only live twice.',
          author: {
            create: {
              email,
              name: 'James Bond'
            }
          }
        },
        select: {
          id: true,
          author: true,
          content: true
        }
      })
      const user = await sqlite.get({ table: 'User', where: { email } })
      const post = await sqlite.get({
        table: 'Post',
        where: { id: received.id.toString() }
      })
      expect(received.author?.name).toEqual('James Bond')
      expect(received.content).toEqual('You only live twice.')
      expect(user.name).toMatch(cloakedStringRegex)
      expect(post.content).toMatch(cloakedStringRegex)
      expect(post.title).toEqual("I'm back") // clear text in the database
    })

    test('update user (with set)', async () => {
      const received = await client.user.update({
        data: {
          name: {
            set: 'Bond, James Bond.'
          }
        },
        where: {
          email
        }
      })
      const user = await sqlite.get({ table: 'User', where: { email } })
      expect(received.name).toEqual('Bond, James Bond.')
      expect(user.name).toMatch(cloakedStringRegex)
    })

    test('complex query nesting', async () => {
      const received = await client.user.create({
        data: {
          email: '006@hmss.gov.uk',
          name: 'Alec Trevelyan',
          posts: {
            create: [
              {
                title: '006 - First report',
                content: 'For England, James?'
              },
              {
                title: 'Janus Quotes',
                content: "I've set the timers for six minutes",
                categories: {
                  create: {
                    name: 'Quotes'
                  }
                }
              }
            ]
          }
        },
        include: {
          posts: {
            include: {
              categories: true
            }
          }
        }
      })
      expect(received.name).toEqual('Alec Trevelyan')
      expect(received.posts[0].content).toEqual('For England, James?')
      expect(received.posts[1].content).toEqual(
        "I've set the timers for six minutes"
      )
      const user = await sqlite.get({
        table: 'User',
        where: { email: '006@hmss.gov.uk' }
      })
      const post1 = await sqlite.get({
        table: 'Post',
        where: { id: received.posts[0].id.toString() }
      })
      const post2 = await sqlite.get({
        table: 'Post',
        where: { id: received.posts[1].id.toString() }
      })
      const category = await sqlite.get({
        table: 'Category',
        where: { name: 'Quotes' }
      })
      expect(user.name).toMatch(cloakedStringRegex)
      expect(post1.content).toMatch(cloakedStringRegex)
      expect(post2.content).toMatch(cloakedStringRegex)
      expect(category.name).toEqual('Quotes')
    })

    test('immutable params', async () => {
      const email = 'xenia@cccp.ru'
      const params = {
        data: {
          name: 'Xenia Onatop',
          email
        }
      }
      const received = await client.user.create(params)
      const user = await sqlite.get({ table: 'User', where: { email } })
      expect(params.data.name).toEqual('Xenia Onatop')
      expect(received.name).toEqual('Xenia Onatop')
      expect(user.name).toMatch(cloakedStringRegex)
    })
  })

  describe('Custom configuration', () => {
    const email = '007@hmss.gov.br'
    const client = createClient(customMiddleware)

    test('create user', async () => {
      const received = await client.user.create({
        data: {
          email,
          name: 'James Bond'
        }
      })

      const dbValue = await sqlite.get({ table: 'User', where: { email } })
      expect(received.name).toEqual('James Bond') // clear text in returned value
      expect(dbValue.name.endsWith(CIPHER)).toBeTruthy() // encrypted in database
    })

    test('update user (with set)', async () => {
      const received = await client.user.update({
        data: {
          name: {
            set: 'Bond, James Bond.'
          }
        },
        where: {
          email
        }
      })
      const user = await sqlite.get({ table: 'User', where: { email } })

      expect(received.name).toEqual('Bond, James Bond.')
      expect(user.name.endsWith(CIPHER)).toBeTruthy()
    })

    test('delete user', async () => {
      const received = await client.user.delete({ where: { email } })
      expect(received.name).toEqual('Bond, James Bond.')
    })
  })
})
