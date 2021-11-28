import { cloakedStringRegex } from '@47ng/cloak'
import { client } from './prismaClient'
import * as sqlite from './sqlite'

describe('integration', () => {
  const email = '007@hmss.gov.uk'
  // process.env.PRISMA_FIELD_ENCRYPTION_LOG = 'true'

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
})
