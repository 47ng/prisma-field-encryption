import { lowercaseFirstLetter, unique } from './utils'

describe('utils', () => {
  describe('lowercaseFirstLetter', () => {
    test('empty string', () => {
      const received = lowercaseFirstLetter('')
      const expected = ''
      expect(received).toEqual(expected)
    })

    test('test string', () => {
      const received = lowercaseFirstLetter('Hello, World!')
      const expected = 'hello, World!'
      expect(received).toEqual(expected)
    })
  })

  describe('unique', () => {
    test('empty array', () => {
      const received = unique([])
      expect(received).toEqual([])
    })

    test('test vector', () => {
      const received = unique([1, 2, 2, 3])
      const expected = [1, 2, 3]
      expect(received).toEqual(expected)
    })
  })
})
