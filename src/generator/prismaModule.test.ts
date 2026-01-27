import path from 'node:path/posix'
import { describe, expect, it } from 'vitest'
import { getPrismaClientModule } from './prismaModule'

describe('getPrismaClientModule', () => {
  it('returns "@prisma/client" when prismaClientOutput ends with node_modules/@prisma/client (forward slashes)', () => {
    const prismaClientOutput = '/some/project/node_modules/@prisma/client'
    const outputDir = '/some/project/src'
    expect(getPrismaClientModule(prismaClientOutput, outputDir)).toBe(
      '@prisma/client'
    )
  })

  it('returns "@prisma/client" when prismaClientOutput ends with node_modules\\@prisma\\client (backslashes)', () => {
    const prismaClientOutput =
      'C:\\some\\project\\node_modules\\@prisma\\client'
    const outputDir = 'C:\\some\\project\\src'
    expect(getPrismaClientModule(prismaClientOutput, outputDir)).toBe(
      '@prisma/client'
    )
  })

  it('returns relative path with forward slashes if not in node_modules', () => {
    const prismaClientOutput = '/some/project/generated/prisma-client'
    const outputDir = '/some/project/src'
    const expected = path
      .relative(outputDir, prismaClientOutput)
      .replace(/\\/g, '/')
    expect(getPrismaClientModule(prismaClientOutput, outputDir)).toBe(expected)
  })

  it('returns relative path with forward slashes if not in node_modules (windows paths)', () => {
    const prismaClientOutput = 'C:\\some\\project\\generated\\prisma-client'
    const outputDir = 'C:\\some\\project\\src'
    const expected = path
      .relative(outputDir, prismaClientOutput)
      .replace(/\\/g, '/')
    expect(getPrismaClientModule(prismaClientOutput, outputDir)).toBe(expected)
  })
})
