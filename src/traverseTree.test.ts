import { traverseTree } from './traverseTree'

describe('traverseTree', () => {
  test('root node is a literal', () => {
    const visitor = jest.fn().mockImplementation(state => state)
    traverseTree('Hello, World!', visitor, null)
    expect(visitor).toHaveBeenCalledTimes(1)
    expect(visitor).toHaveBeenCalledWith(null, {
      key: undefined,
      path: [],
      node: 'Hello, World!',
      type: 'string'
    })
  })

  test('root node is an array', () => {
    const visitor = jest.fn().mockImplementation(state => state)
    traverseTree(['John', 'Paul', 'George', 'Ringo'], visitor, null)
    expect(visitor).toHaveBeenCalledTimes(5)
    expect(visitor.mock.calls[0][1]).toEqual({
      key: undefined,
      path: [],
      node: ['John', 'Paul', 'George', 'Ringo'],
      type: 'array'
    })
    expect(visitor.mock.calls[1][1]).toEqual({
      key: '0',
      path: ['0'],
      node: 'John',
      type: 'string'
    })
    expect(visitor.mock.calls[2][1]).toEqual({
      key: '1',
      path: ['1'],
      node: 'Paul',
      type: 'string'
    })
    expect(visitor.mock.calls[3][1]).toEqual({
      key: '2',
      path: ['2'],
      node: 'George',
      type: 'string'
    })
    expect(visitor.mock.calls[4][1]).toEqual({
      key: '3',
      path: ['3'],
      node: 'Ringo',
      type: 'string'
    })
  })

  test('root node is an object', () => {
    const visitor = jest.fn().mockImplementation(state => state)
    const input = {
      John: 'Lennon',
      Paul: 'McCartney',
      George: 'Harrison',
      Ringo: 'Starr'
    }
    traverseTree(input, visitor, null)
    expect(visitor).toHaveBeenCalledTimes(5)
    expect(visitor.mock.calls[0][1]).toEqual({
      key: undefined,
      path: [],
      node: input,
      type: 'object'
    })
    expect(visitor.mock.calls[1][1]).toEqual({
      key: 'John',
      path: ['John'],
      node: 'Lennon',
      type: 'string'
    })
    expect(visitor.mock.calls[2][1]).toEqual({
      key: 'Paul',
      path: ['Paul'],
      node: 'McCartney',
      type: 'string'
    })
    expect(visitor.mock.calls[3][1]).toEqual({
      key: 'George',
      path: ['George'],
      node: 'Harrison',
      type: 'string'
    })
    expect(visitor.mock.calls[4][1]).toEqual({
      key: 'Ringo',
      path: ['Ringo'],
      node: 'Starr',
      type: 'string'
    })
  })

  test('complex object with branch state', () => {
    const visitor = jest
      .fn()
      .mockImplementation((state, { path, node, type }) => {
        if (type === 'object' && path.length === 2 && path[0] === 'members') {
          return {
            currentMember: `${node.firstName} ${node.lastName}`
          }
        }
        return state
      })
    const input = {
      bandName: 'The Beatles',
      formedIn: 1960,
      currentlyActive: false,
      members: [
        {
          firstName: 'John',
          lastName: 'Lennon',
          birth: '1940-10-09',
          death: '1980-12-08'
        },
        {
          firstName: 'Paul',
          lastName: 'McCartney',
          birth: '1942-06-18',
          death: null
        },
        {
          firstName: 'George',
          lastName: 'Harrison',
          birth: '1943-02-25',
          death: '2001-11-29'
        },
        {
          firstName: 'Ringo',
          lastName: 'Starr',
          birth: '1940-07-07',
          death: null
        }
      ]
    }
    traverseTree(input, visitor, { currentMember: null })
    expect(visitor).toHaveBeenCalledTimes(25)
    expect(visitor.mock.calls).toEqual([
      [
        { currentMember: null },
        { node: input, key: undefined, path: [], type: 'object' }
      ],
      [
        { currentMember: null },
        {
          node: 'The Beatles',
          key: 'bandName',
          path: ['bandName'],
          type: 'string'
        }
      ],
      [
        { currentMember: null },
        {
          node: 1960,
          key: 'formedIn',
          path: ['formedIn'],
          type: 'number'
        }
      ],
      [
        { currentMember: null },
        {
          node: false,
          key: 'currentlyActive',
          path: ['currentlyActive'],
          type: 'boolean'
        }
      ],
      [
        { currentMember: null },
        {
          node: input.members,
          key: 'members',
          path: ['members'],
          type: 'array'
        }
      ],
      [
        { currentMember: null },
        {
          node: input.members[0],
          key: '0',
          path: ['members', '0'],
          type: 'object'
        }
      ],
      [
        { currentMember: 'John Lennon' },
        {
          node: 'John',
          key: 'firstName',
          path: ['members', '0', 'firstName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'John Lennon' },
        {
          node: 'Lennon',
          key: 'lastName',
          path: ['members', '0', 'lastName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'John Lennon' },
        {
          node: '1940-10-09',
          key: 'birth',
          path: ['members', '0', 'birth'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'John Lennon' },
        {
          node: '1980-12-08',
          key: 'death',
          path: ['members', '0', 'death'],
          type: 'string'
        }
      ],
      [
        { currentMember: null },
        {
          node: input.members[1],
          key: '1',
          path: ['members', '1'],
          type: 'object'
        }
      ],
      [
        { currentMember: 'Paul McCartney' },
        {
          node: 'Paul',
          key: 'firstName',
          path: ['members', '1', 'firstName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'Paul McCartney' },
        {
          node: 'McCartney',
          key: 'lastName',
          path: ['members', '1', 'lastName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'Paul McCartney' },
        {
          node: '1942-06-18',
          key: 'birth',
          path: ['members', '1', 'birth'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'Paul McCartney' },
        {
          node: null,
          key: 'death',
          path: ['members', '1', 'death'],
          type: 'null'
        }
      ],
      [
        { currentMember: null },
        {
          node: input.members[2],
          key: '2',
          path: ['members', '2'],
          type: 'object'
        }
      ],
      [
        { currentMember: 'George Harrison' },
        {
          node: 'George',
          key: 'firstName',
          path: ['members', '2', 'firstName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'George Harrison' },
        {
          node: 'Harrison',
          key: 'lastName',
          path: ['members', '2', 'lastName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'George Harrison' },
        {
          node: '1943-02-25',
          key: 'birth',
          path: ['members', '2', 'birth'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'George Harrison' },
        {
          node: '2001-11-29',
          key: 'death',
          path: ['members', '2', 'death'],
          type: 'string'
        }
      ],
      [
        { currentMember: null },
        {
          node: input.members[3],
          key: '3',
          path: ['members', '3'],
          type: 'object'
        }
      ],
      [
        { currentMember: 'Ringo Starr' },
        {
          node: 'Ringo',
          key: 'firstName',
          path: ['members', '3', 'firstName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'Ringo Starr' },
        {
          node: 'Starr',
          key: 'lastName',
          path: ['members', '3', 'lastName'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'Ringo Starr' },
        {
          node: '1940-07-07',
          key: 'birth',
          path: ['members', '3', 'birth'],
          type: 'string'
        }
      ],
      [
        { currentMember: 'Ringo Starr' },
        {
          node: null,
          key: 'death',
          path: ['members', '3', 'death'],
          type: 'null'
        }
      ]
    ])
  })

  const leaf = (index: number) => ({
    hello: 'world',
    index
  })
  const array = Array.from({ length: 1_000_000 }, (_, i) => leaf(i))

  test('root node is an array with 1 million rows', () => {
    const visitor = jest.fn().mockImplementation(state => state)
    traverseTree(array, visitor, null)
    expect(visitor).toHaveBeenCalledTimes(3000001)
  })
})
