// @ts-check

import { parseAnnotation } from './dmmf'

describe('dmmf', () => {
  describe('parseAnnotation', () => {
    test('no annotation at all', () => {
      const received = parseAnnotation()
      const expected = null
      expect(received).toEqual(expected)
    })

    test('no @encrypted keyword', () => {
      const received = parseAnnotation('not encrypted')
      const expected = null
      expect(received).toEqual(expected)
    })

    test('@encrypted keyword alone', () => {
      const received = parseAnnotation(' pre @encrypted post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?with=junk', () => {
      const received = parseAnnotation(' pre @encrypted?with=junk post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?strict', () => {
      const received = parseAnnotation(' pre @encrypted?strict post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(true)
    })

    test('@encrypted?readonly', () => {
      const received = parseAnnotation(' pre @encrypted?readonly post ')
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('readonly takes precedence over strict', () => {
      const received = parseAnnotation(' pre @encrypted?strict&readonly post ')
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })
  })
})
