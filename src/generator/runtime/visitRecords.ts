import { defaultProgressReport, ProgressReportCallback } from './progressReport'

export type RecordVisitor<PrismaClient, Cursor> = (
  client: PrismaClient,
  cursor: Cursor | undefined
) => Promise<Cursor | undefined>

export interface VisitRecordsArgs<PrismaClient, Cursor> {
  modelName: string
  client: PrismaClient
  getTotalCount: () => Promise<number>
  migrateRecord: RecordVisitor<PrismaClient, Cursor>
  reportProgress?: ProgressReportCallback
}

export async function visitRecords<PrismaClient, Cursor>({
  modelName,
  client,
  getTotalCount,
  migrateRecord,
  reportProgress = defaultProgressReport
}: VisitRecordsArgs<PrismaClient, Cursor>) {
  const totalCount = await getTotalCount()
  if (totalCount === 0) {
    return 0
  }
  let cursor: Cursor | undefined = undefined
  let processed = 0
  while (true) {
    const tick = performance.now()
    const newCursor: Cursor | undefined = await migrateRecord(client, cursor)
    if (newCursor === cursor) {
      break // Reached the end
    }
    cursor = newCursor
    processed++
    const tock = performance.now()
    reportProgress({
      model: modelName,
      processed,
      totalCount,
      performance: tock - tick
    })
  }
  return processed
}
