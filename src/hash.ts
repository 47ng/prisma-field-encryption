import { decoders, encoders } from '@47ng/codec'
import crypto from 'node:crypto'
import { HashFieldConfiguration } from 'types'

export function hashString(
  input: string,
  config: Omit<HashFieldConfiguration, 'sourceField'>
) {
  const decode = decoders[config.inputEncoding]
  const encode = encoders[config.outputEncoding]
  const data = decode(input)
  const hash = crypto.createHash(config.algorithm)
  hash.update(data)
  if (config.salt) {
    hash.update(decode(config.salt))
  }
  return encode(hash.digest())
}
