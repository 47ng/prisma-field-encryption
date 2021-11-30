import { cloakedStringRegex } from '@47ng/cloak'
import { client } from './prismaClient'
import * as sqlite from './sqlite'

describe('integration', () => {
  const email = '007@hmss.gov.uk'

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
  // test('Available APIs with write operations', async () => {
  //   // params.args.data.name
  //   // params.args.posts.create.content
  //   // params.args.posts.create.$.content
  //   // params.args.posts.connectOrCreate.create.content
  //   client.user.create({
  //     data: {
  //       name: '',
  //       email,
  //       posts: {
  //         create: [{ title: '', content: '' }],
  //         // create: {
  //         //   title: '',
  //         //   content: ''
  //         // },
  //         connectOrCreate: {
  //           create: {
  //             // cannot be an array
  //             title: '',
  //             content: ''
  //           },
  //           where: {
  //             id: 2
  //           }
  //         }
  //       }
  //     }
  //   })

  //   // Update
  //   client.user.update({
  //     data: {
  //       name: 'foo'
  //     },
  //     where: {
  //       email
  //     }
  //   })

  //   // Update with all possible nested queries:
  //   // params.args.data.name
  //   // params.args.data.name.set
  //   // params.args.data.name
  //   // params.args.data.posts.create.content
  //   // params.args.data.posts.connectOrCreate.create.content
  //   // params.args.data.posts.update.data.content
  //   // params.args.data.posts.update.data.content.set
  //   // params.args.data.posts.updateMany.data.content
  //   // params.args.data.posts.updateMany.data.content.set
  //   // params.args.data.posts.upsert.create.content
  //   // params.args.data.posts.upsert.update.content
  //   // params.args.data.posts.upsert.update.content.set

  //   client.user.update({
  //     data: {
  //       name: {
  //         set: 'foo' // alternative way to set things: update.data.field.set
  //       },
  //       posts: {
  //         create: {
  //           title: '',
  //           content: ''
  //         },
  //         connectOrCreate: {
  //           create: {
  //             title: '',
  //             content: ''
  //           },
  //           where: {
  //             id: 2
  //           }
  //         },
  //         update: {
  //           data: {
  //             content: {
  //               set: ''
  //             }
  //           },
  //           where: {
  //             id: 2
  //           }
  //         },
  //         updateMany: {
  //           data: {
  //             content: {
  //               set: ''
  //             }
  //           },
  //           where: {
  //             published: true
  //           }
  //         },
  //         upsert: {
  //           create: {
  //             title: '',
  //             content: ''
  //           },
  //           update: {
  //             content: {
  //               set: ''
  //             }
  //           },
  //           where: {
  //             id: 1
  //           }
  //         }
  //       }
  //     },
  //     where: {
  //       email
  //     }
  //   })
  //   client.user.updateMany()
  //   client.user.upsert()
  // })
})
