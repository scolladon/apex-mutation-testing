import type { Messages } from '@salesforce/core'
import type { Spinner } from '@salesforce/sf-plugins-core'
import type { EngineNotice } from '../port/executionEngine.js'
import { sanitizeForDisplay } from './skippedTestClassMessage.js'

// A single-purpose write port so a caller can inject a stub in tests instead
// of spying on the process-global stdout stream. Defaults to the real
// stdout, so run.ts needs no change to keep its current behaviour.
export type OutputSink = (text: string) => void

export const writeToStdout: OutputSink = text => {
  process.stdout.write(text)
}

// @jsforce/jsforce-node sets `error.message` to the entire raw response body
// when it is neither a parseable JSON error nor text/html (see
// http-api.js), so any org/network failure detail is unbounded. Bounds the
// details rendered through this module — the sync-transport fallback reason
// below — and the rollback failure cause, which imports renderOrgDetail from
// here. It is NOT a CLI-wide invariant: the compile-gate rethrow in
// mutationTestingService and groupExecutor's runtime-error progress line both
// render org text without it. Do not restate this as "every org-supplied
// detail" until those two sinks route here; an over-broad claim here is what
// stops the gap from being closed.
const MAX_ORG_ERROR_DETAIL_LENGTH = 200

// Truncates by code point, not by UTF-16 index, so a surrogate pair is
// never split.
const truncateForDisplay = (value: string, maxLength: number): string => {
  const codePoints = Array.from(value)
  return codePoints.length <= maxLength
    ? value
    : `${codePoints.slice(0, maxLength).join('')}…`
}

// How every org-supplied detail this module renders is prepared: jsforce
// sets `error.message` to the entire raw response body when it is neither
// parseable JSON nor text/html (see http-api.js), so the text is unbounded
// and may contain control bytes. Sanitizing runs first so the length budget
// is spent on characters a human can read — truncating first can spend the
// whole bound on control bytes that then fold away to nothing, erasing the
// diagnostic entirely. Applying only one of the two steps leaves the other
// half of the hazard in place.
export const renderOrgDetail = (detail: string): string =>
  truncateForDisplay(sanitizeForDisplay(detail), MAX_ORG_ERROR_DETAIL_LENGTH)

// Uses spinner.pause, not the start/stop pair announceSkips relies on:
// oclif's stop() no-ops when no task is running, and start() replaces the
// current task without stopping it, so that idiom would silently swallow a
// later 'Original tests passed'. pause() is safe whether or not a task is
// active. The reason is org/network-controlled and unbounded — sanitized
// the same way as the compile-diagnosis path, then length-bounded, before it
// reaches the injected output sink.
const renderSyncTransportFallback = (
  notice: EngineNotice,
  spinner: Spinner,
  messages: Messages<string>,
  sink: OutputSink
): void => {
  spinner.pause(() => {
    const reason = renderOrgDetail(notice.error.message)
    sink(`${messages.getMessage('info.syncTransportFallback', [reason])}\n`)
  })
}

// Keyed on the notice tag rather than rendering unconditionally: EngineNotice
// is a union with one member today, and a Record makes an unhandled future
// kind a compile error instead of a wrong message. Without it, a second kind
// would type-check, reach this function, and be announced to the user as a
// synchronous-transport fallback. A lookup rather than a switch, for the same
// reason the engine factory uses one: an unreachable default arm cannot be
// covered.
const NOTICE_RENDERERS: Record<
  EngineNotice['kind'],
  typeof renderSyncTransportFallback
> = {
  'sync-transport-fallback': renderSyncTransportFallback,
}

export const reportEngineNotice = (
  notice: EngineNotice,
  spinner: Spinner,
  messages: Messages<string>,
  sink: OutputSink = writeToStdout
): void => {
  NOTICE_RENDERERS[notice.kind](notice, spinner, messages, sink)
}
