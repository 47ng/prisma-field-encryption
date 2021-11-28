import path from 'path'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

async function openDatabase() {
  return open({
    filename: path.resolve(__dirname, '../../prisma/db.integration.sqlite'),
    driver: sqlite3.Database
  })
}

export interface SQLiteQuery {
  table: 'User' | 'Post'
  where?: {
    [field: string]: string
  }
}

export async function get({ table, where = {} }: SQLiteQuery) {
  const whereFields = Object.keys(where ?? {})
  const whereQuery = whereFields
    .map(field => `${field} = :${field}`)
    .join(' and ')
  const query = `select * from ${table}${
    whereFields.length ? ` where ${whereQuery}` : ''
  }`
  const args = whereFields.reduce(
    (args, field) => ({
      ...args,
      [`:${field}`]: where[field]
    }),
    {}
  )
  const db = await openDatabase()
  const result = await db.get(query, args)
  await db.close()
  return result
}
