import { Messages } from '@salesforce/core'
import type { Spinner } from '@salesforce/sf-plugins-core'
import { reportEngineNotice } from '../../../src/service/engineNotice.js'

// Relocated verbatim from mutationTestingService.test.ts's "When the adapter
// reports a synchronous transport fallback" describe block: the
// assertion bodies are unchanged, only the driver is — each test now calls
// reportEngineNotice directly instead of fishing onSyncFallback out of a
// mocked ApexTestRunner constructor call after driving an aborting baseline.
describe('reportEngineNotice', () => {
  let spinnerStub: Spinner
  let messagesMock: Messages<string>
  let sinkStub: ReturnType<typeof vi.fn>

  beforeEach(() => {
    spinnerStub = {
      start: vi.fn(),
      stop: vi.fn(),
      // Models oclif's real pause(): invokes the callback synchronously and
      // (unlike stop()) never no-ops when no task is running.
      pause: vi.fn((fn: () => void) => fn()),
    } as unknown as Spinner

    const resolveMessageTemplate = (key: string, args?: string[]): string => {
      const templates: Record<string, string> = {
        'info.syncTransportFallback': `Synchronous test execution is unavailable (${args?.[0]}). Falling back to the asynchronous transport.`,
      }
      return templates[key] || key
    }

    messagesMock = {
      getMessage: vi.fn(resolveMessageTemplate),
      createError: vi.fn(
        (key: string, tokens?: string[]) =>
          new Error(resolveMessageTemplate(key, tokens))
      ),
    } as unknown as Messages<string>

    sinkStub = vi.fn()
  })

  it('then should announce the reason through the injected output sink after pausing the spinner', () => {
    // Act
    reportEngineNotice(
      {
        kind: 'sync-transport-fallback',
        error: new Error('View Setup permission required'),
      },
      spinnerStub,
      messagesMock,
      sinkStub
    )

    // Assert — the reporting channel is an injected sink, not a spy on the
    // process-global stdout stream
    expect(spinnerStub.pause).toHaveBeenCalled()
    expect(sinkStub).toHaveBeenCalledWith(
      expect.stringContaining('View Setup permission required')
    )
  })

  it('then should sanitize control characters out of the reported reason before writing it', () => {
    // Arrange — the org/network-controlled message can carry a newline or a
    // bidi override character; the reason portion of the written line must
    // stay on one line and carry no such character through. The write itself
    // still ends in exactly one trailing newline — that terminator is this
    // call site's own, not part of the reason.

    // Act
    reportEngineNotice(
      {
        kind: 'sync-transport-fallback',
        error: new Error('View Setup‮required\nsecond line'),
      },
      spinnerStub,
      messagesMock,
      sinkStub
    )

    // Assert
    const [written] = sinkStub.mock.calls[0] as [string]
    expect(written).toContain('View Setup required second line')
    expect(written).not.toContain('‮')
    expect(written.indexOf('\n')).toBe(written.length - 1)
  })

  it('then should bound the length of an unbounded reason before writing it', () => {
    // Arrange — @jsforce/jsforce-node sets `error.message` to the entire raw
    // response body when it cannot be parsed as a JSON error or text/html, so
    // it is not bounded upstream.
    const unboundedReason = 'x'.repeat(5000)

    // Act
    reportEngineNotice(
      { kind: 'sync-transport-fallback', error: new Error(unboundedReason) },
      spinnerStub,
      messagesMock,
      sinkStub
    )

    // Assert — the written line carries exactly the first 200 code points
    // followed by an ellipsis, not just "some short string": a bare length
    // check alone cannot tell a real truncation apart from the reason
    // collapsing to nothing.
    const [written] = sinkStub.mock.calls[0] as [string]
    expect(written).toContain(`${'x'.repeat(200)}…`)
    expect(written.length).toBeLessThan(500)
  })

  it('then should not truncate a reason exactly at the length boundary', () => {
    // Arrange — pins the `<=` boundary in truncateForDisplay: a reason of
    // exactly 200 code points must pass through untouched, with no ellipsis
    // appended.
    const boundaryReason = 'x'.repeat(200)

    // Act
    reportEngineNotice(
      { kind: 'sync-transport-fallback', error: new Error(boundaryReason) },
      spinnerStub,
      messagesMock,
      sinkStub
    )

    // Assert — the full reason survives, verbatim, with no truncation marker
    const [written] = sinkStub.mock.calls[0] as [string]
    expect(written).toBe(
      `Synchronous test execution is unavailable (${boundaryReason}). Falling back to the asynchronous transport.\n`
    )
  })

  it('then should default to writing through the real stdout when no output sink is injected', () => {
    // Arrange — run.ts constructs the notice with no sink argument; the
    // default must still reach the real terminal.
    const stdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    // Act
    reportEngineNotice(
      {
        kind: 'sync-transport-fallback',
        error: new Error('View Setup permission required'),
      },
      spinnerStub,
      messagesMock
    )

    // Assert
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('View Setup permission required')
    )

    stdoutWriteSpy.mockRestore()
  })

  it('Given a reason where a run of control characters sits just inside the length bound and readable text follows it, When reported, Then the readable tail survives because sanitizing runs before truncating', () => {
    // Arrange — neither relocated fixture above exercises the
    // ordering claim: the short control-character fixture never reaches the
    // 200-code-point bound, and the unbounded fixture carries no control
    // characters, so both pass identically under either operation order.
    // This fixture combines the two: truncating before sanitizing would slice
    // through the run of newlines and drop "END" together with the folded
    // space, silently erasing the tail of the diagnostic.
    const reason = `${'x'.repeat(195)}${'\n'.repeat(10)}END`

    // Act
    reportEngineNotice(
      { kind: 'sync-transport-fallback', error: new Error(reason) },
      spinnerStub,
      messagesMock,
      sinkStub
    )

    // Assert
    const [written] = sinkStub.mock.calls[0] as [string]
    expect(written).toContain('END')
  })

  it('Given a reason whose 200th and 201st code points straddle a surrogate pair, When reported, Then the pair is never split', () => {
    // Arrange — U+1F600 sits at code points 200-201 (a lone astral character
    // is one code point but two UTF-16 units); a UTF-16-index truncation at
    // 200 would slice through the high surrogate and leave it dangling.
    const surrogatePairReason = `${'x'.repeat(199)}😀${'y'.repeat(50)}`

    // Act
    reportEngineNotice(
      {
        kind: 'sync-transport-fallback',
        error: new Error(surrogatePairReason),
      },
      spinnerStub,
      messagesMock,
      sinkStub
    )

    // Assert — the pair is kept whole: the 200-code-point slice includes the
    // full emoji or none of it, never a lone surrogate.
    const [written] = sinkStub.mock.calls[0] as [string]
    expect(written).toContain(`${'x'.repeat(199)}😀…`)
    expect(written).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })
})
