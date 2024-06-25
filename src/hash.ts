import { decoders, encoders } from '@47ng/codec'
import crypto from 'node:crypto'
import { HashFieldConfiguration, HashFieldSanitizeOptions } from './types'

export function hashString(
  input: string,
  config: Omit<HashFieldConfiguration, 'sourceField'>
) {
  const decode = decoders[config.inputEncoding]
  const encode = encoders[config.outputEncoding]
  const sanitized = sanitizeHashString(input, config.sanitize)

  const data = decode(sanitized)
  const hash = crypto.createHash(config.algorithm)
  hash.update(data)
  if (config.salt) {
    hash.update(decode(config.salt))
  }
  return encode(hash.digest())
}

export function sanitizeHashString(
  input: string,
  options: HashFieldSanitizeOptions[] = []
) {
  let output = input
  if (options.includes(HashFieldSanitizeOptions.lowercase)) {
    output = output.toLowerCase()
  }
  if (options.includes(HashFieldSanitizeOptions.uppercase)) {
    output = output.toUpperCase()
  }
  if (options.includes(HashFieldSanitizeOptions.trim)) {
    output = output.trim()
  }
  if (options.includes(HashFieldSanitizeOptions.spaces)) {
    output = output.replace(/\s/g, '')
  }
  if (options.includes(HashFieldSanitizeOptions.diacritics)) {
    output = output.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  return output
}
