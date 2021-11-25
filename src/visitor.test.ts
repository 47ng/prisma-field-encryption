import { getStringLeafPaths } from './visitor'
describe('visitor', () => {
  test('getStringLeafPaths', () => {
    const testObject = {
      foo: 'bar',
      number: 42,
      boolean: true,
      null: null,
      obj: {
        key: 'value'
      },
      arr: [
        {
          key: 'value',
          nested: [{ array: { of: 'foo' } }, [{ array: 'within an array' }]]
        }
      ]
    }
    const received = getStringLeafPaths(testObject)
    const expected = [
      'foo',
      'obj.key',
      'arr.0.key',
      'arr.0.nested.0.array.of',
      'arr.0.nested.1.0.array'
    ]
    expect(received).toEqual(expected)
  })
})
