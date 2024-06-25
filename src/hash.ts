import { decoders, encoders } from '@47ng/codec'
import crypto from 'node:crypto'
import { HashFieldConfiguration, HashFieldNormalizeOptions } from './types'

export function hashString(
  input: string,
  config: Omit<HashFieldConfiguration, 'sourceField'>
) {
  const decode = decoders[config.inputEncoding]
  const encode = encoders[config.outputEncoding]
  const normalized = normalizeHashString(input, config.normalize)

  const data = decode(normalized)
  const hash = crypto.createHash(config.algorithm)
  hash.update(data)
  if (config.salt) {
    hash.update(decode(config.salt))
  }
  return encode(hash.digest())
}

export function normalizeHashString(
  input: string,
  options: HashFieldNormalizeOptions[] = []
) {
  let output = input
  if (options.includes(HashFieldNormalizeOptions.lowercase)) {
    output = output.toLowerCase()
  }
  if (options.includes(HashFieldNormalizeOptions.uppercase)) {
    output = output.toUpperCase()
  }
  if (options.includes(HashFieldNormalizeOptions.trim)) {
    output = output.trim()
  }
  if (options.includes(HashFieldNormalizeOptions.spaces)) {
    output = output.replace(/\s/g, '')
  }
  if (options.includes(HashFieldNormalizeOptions.diacritics)) {
    output = output.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  return output
}
