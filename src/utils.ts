export const lowercaseFirstLetter = (input: string) => {
  if (input.length === 0) {
    return ''
  }
  return input[0].toLowerCase() + input.slice(1)
}

export const unique = <T>(items: T[]): T[] => Array.from(new Set(items))
