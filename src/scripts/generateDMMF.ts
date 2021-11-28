import { Prisma } from '.prisma/client'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function generateDMMF() {
  const outputPath = path.resolve(__dirname, '../../prisma/dmmf.json')
  await fs.writeFile(outputPath, JSON.stringify(Prisma.dmmf, null, 2))
}

if (require.main === module) {
  generateDMMF()
}
