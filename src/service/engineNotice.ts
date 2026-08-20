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
  notice: Extract<EngineNotice, { kind: 'sync-transport-fallback' }>,
  spinner: Spinner,
  messages: Messages<string>,
  sink: OutputSink
): void => {
  spinner.pause(() => {
    const reason = renderOrgDetail(notice.error.message)
    sink(`${messages.getMessage('info.syncTransportFallback', [reason])}\n`)
  })
}

// Reuses renderOrgDetail for both the joined type names and the error
// message: both are org-supplied (the names come from a describe/query
// response) and therefore share the same unbounded-length, unsanitized
// hazard as the sync-transport reason above.
const renderTypeResolutionDegraded = (
  notice: Extract<EngineNotice, { kind: 'type-resolution-degraded' }>,
  spinner: Spinner,
  messages: Messages<string>,
  sink: OutputSink
): void => {
  spinner.pause(() => {
    const names = renderOrgDetail(notice.typeNames.join(', '))
    const reason = notice.error
      ? ` (${renderOrgDetail(notice.error.message)})`
      : ''
    sink(
      `${messages.getMessage('info.typeResolutionDegraded', [names, reason])}\n`
    )
  })
}

// Keyed on the notice tag rather than rendering unconditionally: EngineNotice
// is a union, and this map makes an unhandled future kind a compile error
// instead of a wrong message. Without it, a new kind would type-check, reach
// this function, and be announced to the user under the wrong renderer. A
// lookup rather than a switch, for the same reason the engine factory uses
// one: an unreachable default arm cannot be covered.
// Correlated on the tag (`[K in EngineNotice['kind']]`) rather than a plain
// `Record` keyed by the renderer's own function type: a plain Record would
// make every slot's parameter the intersection of every arm's narrow notice
// type, which is `never`, forcing method shorthand to work around it — and
// method shorthand is checked bivariantly even under strictFunctionTypes, so
// a renderer registered under the wrong kind would compile clean and only
// TypeError at runtime on the field the wrong notice shape lacks. A plain
// function-type property in a correlated mapped type is checked
// contravariantly, so a swapped registration is a compile error here.
type NoticeRenderers = {
  [K in EngineNotice['kind']]: (
    notice: Extract<EngineNotice, { kind: K }>,
    spinner: Spinner,
    messages: Messages<string>,
    sink: OutputSink
  ) => void
}

const NOTICE_RENDERERS: NoticeRenderers = {
  'sync-transport-fallback': renderSyncTransportFallback,
  'type-resolution-degraded': renderTypeResolutionDegraded,
}

// The one dispatch site needs one assertion: `notice.kind` narrows `notice`
// for the caller, but indexing `NOTICE_RENDERERS` by that same key does not
// re-derive the correlation between the key and `notice`'s own narrowed type
// that the object literal above already proved once, at its own type-check —
// indexing `NoticeRenderers` by the whole `EngineNotice['kind']` union instead
// reproduces the same never-typed intersection the mapped type exists to
// avoid, so the assertion target is the wide, unnarrowed signature.
type NoticeRenderer = (
  notice: EngineNotice,
  spinner: Spinner,
  messages: Messages<string>,
  sink: OutputSink
) => void

export const reportEngineNotice = (
  notice: EngineNotice,
  spinner: Spinner,
  messages: Messages<string>,
  sink: OutputSink = writeToStdout
): void => {
  const render = NOTICE_RENDERERS[notice.kind] as NoticeRenderer
  render(notice, spinner, messages, sink)
}
