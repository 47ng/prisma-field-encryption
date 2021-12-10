export interface ProgressReport {
  model: string
  processed: number
  totalCount: number
  performance: number
}

export type ProgressReportCallback = (
  progress: ProgressReport
) => void | Promise<void>

export const defaultProgressReport: ProgressReportCallback = ({
  model,
  totalCount,
  processed,
  performance
}) => {
  const length = totalCount.toString().length
  const pct = Math.round((100 * processed) / totalCount)
    .toString()
    .padStart(3)
  console.info(
    `${model.padEnd(32)} ${pct}% processed ${processed
      .toString()
      .padStart(length)} / ${totalCount} (took ${performance.toFixed(2)}ms)`
  )
}
