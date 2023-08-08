import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

function hashSync(input: string) {
  const hash = crypto.createHash('sha256')
  hash.update(input)
  return hash.digest('hex')
}

function hashNode(input: string) {
  const hash = crypto.createHash('sha256')
  hash.update(input)
  return Promise.resolve(hash.digest('hex'))
}

async function hashWebCrypto(input: string) {
  const utf8 = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', utf8.encode(input))
  return Buffer.from(hash).toString('hex')
}

async function compute(input: string) {
  // JIT warmup
  hashSync(input)
  await hashNode(input)
  await hashWebCrypto(input)

  const RUNS = 10_000
  let syncTime = 0
  let nodeTime = 0
  let webCryptoTime = 0

  for (let i = 0; i < RUNS; ++i) {
    const tick = performance.now()
    hashSync(input)
    const tack = performance.now()
    await hashNode(input)
    const tock = performance.now()
    await hashWebCrypto(input)
    const tuck = performance.now()

    syncTime += tack - tick
    nodeTime += tock - tack
    webCryptoTime += tuck - tock
  }
  return {
    node: nodeTime / RUNS,
    webCrypto: webCryptoTime / RUNS,
    sync: syncTime / RUNS
  }
}

async function main() {
  const empty = await compute('')
  console.dir({ empty })
  const small = await compute('hello, world')
  console.dir({ small })
  const medium = await compute(
    "const hash = await crypto.subtle.digest('SHA-256', utf8.encode(input))"
  )
  console.dir({ medium })
  const large = await compute(`A Elbereth Gilthoniel
  silivren penna míriel
  o menel aglar elenath!
  Na-chaered palan-díriel
  o galadhremmin ennorath,
  Fanuilos, le linnathon
  nef aear, sí nef aearon!

  A Elbereth Gilthoniel
  o menel palan-diriel,
  le nallon sí di'nguruthos!
  A tiro nin, Fanuilos!`)
  console.dir({ large })
  const hugeString = await fs.readFile(
    './src/tests/.generated/client/index.d.ts',
    'utf-8'
  )
  const huge = await compute(hugeString)
  console.dir({ huge })
}

main()
