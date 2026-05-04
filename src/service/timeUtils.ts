export const timeExecution = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> => {
  const start = performance.now()
  const result = await fn()
  const durationMs = performance.now() - start
  return { result, durationMs }
}

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  if (hours > 0) {
    return `~${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `~${minutes}m ${seconds}s`
  }
  return `~${seconds}s`
}

export const formatRemainingTime = (
  loopStartTime: number,
  completedCount: number,
  totalCount: number
): string => {
  if (completedCount === 0) return ''
  const elapsed = performance.now() - loopStartTime
  const avgPerMutant = elapsed / completedCount
  const remainingMs = avgPerMutant * (totalCount - completedCount)
  return `Remaining: ${formatDuration(remainingMs)} | `
}
