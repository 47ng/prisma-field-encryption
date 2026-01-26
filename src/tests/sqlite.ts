import path from 'node:path'
import Database from 'better-sqlite3'

function openDatabase() {
  return new Database(
    path.resolve(__dirname, '../../prisma/db.integration.sqlite')
  )
}

export interface SQLiteQuery {
  table: 'User' | 'Post' | 'Category'
  where?: {
    [field: string]: string
  }
}

export async function get<T = Record<string, unknown>>({ table, where = {} }: SQLiteQuery): Promise<T | undefined> {
  const whereFields = Object.keys(where ?? {})
  const whereQuery = whereFields
    .map(field => `${field} = :${field}`)
    .join(' and ')
  const query = `select * from ${table}${
    whereFields.length ? ` where ${whereQuery}` : ''
  }`
  const args = whereFields.reduce<Record<string, string>>(
    (args, field) => ({
      ...args,
      [field]: where[field]
    }),
    {}
  )
  const db = openDatabase()
  const stmt = db.prepare(query)
  const result = stmt.get(args) as T | undefined
  db.close()
  return result
}
