type LeafNode = string | number | boolean | bigint
type Collection = Array<any> | Record<any, any>
type Element = Collection | LeafNode

function isObject(obj: any): obj is object {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Object]'
  )
}

export function getStringLeafPaths(input: Element, path?: string): string[] {
  if (isObject(input) || Array.isArray(input)) {
    return Object.entries(input)
      .filter(
        ([, value]) =>
          typeof value === 'string' || Array.isArray(value) || isObject(value)
      )
      .reduce((out, [key, value]) => {
        if (typeof value === 'string') {
          return [...out, path ? [path, key].join('.') : key]
        }
        if (Array.isArray(value)) {
          return [
            ...out,
            ...value.flatMap((item, index) =>
              getStringLeafPaths(
                item,
                path ? [path, key, index].join('.') : [key, index].join('.')
              )
            )
          ]
        }
        if (isObject(value)) {
          return [
            ...out,
            ...getStringLeafPaths(value, path ? [path, key].join('.') : key)
          ]
        }
        return out
      }, [] as string[])
  }
  if (typeof input === 'string' && path) {
    return [path]
  }
  return []
}
