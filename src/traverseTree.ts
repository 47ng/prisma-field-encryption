export type Literal = string | number | boolean | null
export type Dict = { [key: string]: Json }
export type Json = Literal | Array<Json> | Dict
export type JsonType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object'

export interface Item {
  key?: string
  path: string[]
  node: Json
  type: JsonType
}

/**
 * Traverse a JSON object depth-first, in a `reduce` manner.
 *
 * @param input The root node to traverse
 * @param callback A function to call on each visited node
 * @param initialState Think of this as the last argument of `reduce`
 */
export function traverseTree<State>(
  input: Json,
  callback: (state: State, item: Item) => State,
  initialState: State
) {
  type StackItem = Item & {
    state: State
  }

  let stack: StackItem[] = [
    {
      path: [],
      type: typeOf(input),
      node: input,
      state: initialState
    }
  ]

  while (stack.length > 0) {
    const { state, ...item } = stack.pop()!
    const newState = callback(state, item)
    if (!isCollection(item.node)) {
      continue
    }
    const children: StackItem[] = Object.entries(item.node).map(
      ([key, child]) => ({
        key,
        node: child,
        type: typeOf(child),
        path: [...item.path, key],
        state: newState
      })
    )
    stack = [...stack, ...children.reverse()]
  }
}

// Helpers --

function isObject(item: Json): item is Dict {
  return (
    typeof item === 'object' &&
    Object.prototype.toString.call(item) === '[object Object]'
  )
}

function isCollection(item: Json): item is Array<Json> | Dict {
  return Array.isArray(item) || isObject(item)
}

function typeOf(item: Json): JsonType {
  if (Array.isArray(item)) {
    return 'array'
  }
  if (isObject(item)) {
    return 'object'
  }
  if (item === null) {
    return 'null'
  }
  return typeof item as JsonType
}
