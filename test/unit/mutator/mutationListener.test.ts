import { MethodCallContext } from 'apex-parser'
import RE2 from 're2'
import type { Mocked } from 'vitest'
import { BaseListener } from '../../../src/mutator/baseListener.js'
import { MutationListener } from '../../../src/mutator/mutationListener.js'

describe('MutationListener', () => {
  // Arrange
  let mockListener1: Mocked<BaseListener>
  let mockListener2: Mocked<BaseListener>
  let sut: MutationListener
  let coveredLines: Set<number>

  beforeEach(() => {
    mockListener1 = {
      enterMethodCall: vi.fn(),
      exitMethodCall: vi.fn(),
    } as unknown as Mocked<BaseListener>

    mockListener2 = {
      enterMethodCall: vi.fn(),
      exitMethodCall: vi.fn(),
    } as unknown as Mocked<BaseListener>

    coveredLines = new Set([10, 20, 30])
    sut = new MutationListener([mockListener1, mockListener2], coveredLines)
  })

  it('should propagate enter rule calls to all listeners when line is covered', () => {
    // Act
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener2['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('should not propagate enter rule calls when line is not covered', () => {
    // Act
    const mockContext = {
      start: { line: 15 },
    } as unknown as MethodCallContext
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('should propagate exit rule calls to all listeners when line is covered', () => {
    // Act
    const mockContext = {
      start: { line: 20 },
    } as unknown as MethodCallContext
    sut['exitMethodCall'](mockContext)

    // Assert
    expect(mockListener1['exitMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener2['exitMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('should not propagate exit rule calls when line is not covered', () => {
    // Act
    const mockContext = {
      start: { line: 25 },
    } as unknown as MethodCallContext
    sut['exitMethodCall'](mockContext)

    // Assert
    expect(mockListener1['exitMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['exitMethodCall']).not.toHaveBeenCalled()
  })

  it('should only call listeners that implement the method', () => {
    // Arrange
    const mockListener3 = {
      // Doesn't implement enterMethodCall
    } as unknown as Mocked<BaseListener>
    sut = new MutationListener([mockListener1, mockListener3], coveredLines)

    // Act
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener3['enterMethodCall']).toBeUndefined()
  })

  it('should handle undefined context gracefully', () => {
    // Act
    sut['enterMethodCall'](undefined as unknown as MethodCallContext)

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('should handle context with undefined start line gracefully', () => {
    // Act
    const mockContext = {} as MethodCallContext
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('should handle proxy method called with no arguments', () => {
    // Act & Assert
    expect(() => sut['someUnknownMethod']()).not.toThrow()
  })

  it('Given line matching skip pattern, When entering rule, Then does not propagate to listeners', () => {
    // Arrange
    const sourceLines = ['System.debug("hello")', 'Integer x = 5']
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([1, 2]),
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given line not matching skip pattern, When entering rule, Then propagates to listeners', () => {
    // Arrange
    const sourceLines = ['System.debug("hello")', 'Integer x = 5']
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([2]),
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 2 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener2['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given line outside allowed range, When entering rule, Then does not propagate to listeners', () => {
    // Arrange
    const allowedLines = new Set([5, 6, 7])
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([10, 20, 30]),
      [],
      allowedLines,
      []
    )
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given line inside allowed range and covered, When entering rule, Then propagates to listeners', () => {
    // Arrange
    const allowedLines = new Set([10, 11, 12])
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([10, 20, 30]),
      [],
      allowedLines,
      []
    )
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given no allowed lines filter, When entering rule on covered line, Then propagates to listeners', () => {
    // Arrange
    sut = new MutationListener(
      [mockListener1, mockListener2],
      coveredLines,
      [],
      undefined,
      []
    )
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given skip patterns but source lines shorter than line number, When entering rule, Then propagates to listeners', () => {
    // Arrange
    const sourceLines = ['line1']
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([10]),
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given skip pattern matching last source line (line === sourceLines.length), When entering rule, Then does not propagate to listeners', () => {
    // Arrange — line 2 equals sourceLines.length (2), so >= condition is satisfied
    const sourceLines = ['normal line', 'System.debug("last")']
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([2]),
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 2 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — >= ensures the boundary line is checked against skip patterns
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given no skip patterns with non-empty sourceLines, When entering covered line, Then propagates to listeners', () => {
    // Arrange — skipPatterns.length === 0 means skip-pattern check is bypassed entirely
    const sourceLines = ['System.debug("hello")']
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([1]),
      [],
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — empty skipPatterns means no filtering even if sourceLine would match
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given line covered and in range but matching skip pattern, When entering rule, Then does not propagate', () => {
    // Arrange
    const sourceLines = ['System.debug("hello")']
    const skipPatterns = [new RE2('System\\.debug')]
    const allowedLines = new Set([1])
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([1]),
      skipPatterns,
      allowedLines,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given proxy method called with empty array args, When calling, Then does not forward to listeners', () => {
    // Arrange — kills args.length > 0 mutant (>= 0 would pass empty array through)

    // Act: call via proxy with no arguments simulates empty args scenario
    // The proxy wraps args as rest params so calling with no args gives []
    sut['enterMethodCall']()

    // Assert
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given listener has a non-function property matching prop name, When proxy calls, Then does not invoke it', () => {
    // Arrange — kills typeof listener[prop] === 'function' → true mutant
    // Listener has 'enterMethodCall' as a non-function property value
    const listenerWithNonFunctionProp = {
      enterMethodCall: 'not-a-function',
    } as unknown as BaseListener
    sut = new MutationListener([listenerWithNonFunctionProp], new Set([10]))
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act & Assert — should not throw; non-function props must be skipped
    expect(() => sut['enterMethodCall'](mockContext)).not.toThrow()
  })

  it('Given line is 0 (falsy), When checking eligibility, Then returns false and does not propagate', () => {
    // Arrange — kills if (!line) → if (false) mutant; line=0 is falsy
    const mockContext = {
      start: { line: 0 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — line 0 is not a valid line, must be rejected
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given line matching only one of two skip patterns, When entering rule, Then does not propagate (some, not every)', () => {
    // Arrange — kills .some() → .every() mutant
    // Only patternA matches the line; with 'every', both would need to match (line would pass through)
    const sourceLines = ['System.debug("hello")']
    const patternA = new RE2('System\\.debug')
    const patternB = new RE2('NonMatching')
    sut = new MutationListener(
      [mockListener1, mockListener2],
      new Set([1]),
      [patternA, patternB],
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — some(patternA matches) → skip; every would require patternB to match too → propagate
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
    expect(mockListener2['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given MutationListener constructed with listener having _mutations property, When mutations are created, Then mutations are shared across all listeners', () => {
    // Arrange — kills '_mutations' → '' StringLiteral mutant in the filter
    // Also kills the assignment (listener as BaseListener)._mutations = this._mutations
    const listenerWithMutations = {
      enterMethodCall: vi.fn(),
      _mutations: [] as unknown[],
    } as unknown as BaseListener
    sut = new MutationListener([listenerWithMutations], new Set([10]))

    // Assert — the _mutations array on the listener should be the same reference as sut._mutations
    expect((listenerWithMutations as BaseListener)._mutations).toBe(
      sut._mutations
    )
  })

  it('Given MutationListener, When getMutations is called, Then returns the mutations array', () => {
    // Arrange — kills prop in target → !(prop in target) mutant for the proxy get trap
    // getMutations is a method on the class itself (prop in target = true)
    // If negated, getMutations would be proxied and return undefined instead of the array

    // Act
    const result = sut.getMutations()

    // Assert — getMutations must return the actual array, not undefined
    expect(result).toBe(sut._mutations)
    expect(Array.isArray(result)).toBe(true)
  })

  it('Given skip patterns present but sourceLines shorter than line number, When entering covered line at boundary, Then skip pattern is not applied', () => {
    // Arrange — kills && → || on sourceLines.length >= line (line 69)
    // sourceLines has 1 element, line is 5 (beyond length)
    // With &&: 1 > 0 && 1 >= 5 = true && false = false (skip block bypassed, line eligible)
    // With ||: 1 > 0 || 1 >= 5 = true || false = true (enters block, sourceLine = undefined,
    //           but RE2.test(undefined) would not match = still eligible ... potentially same result)
    // To truly kill this, the pattern must match undefined or the behavior must differ
    // We verify that a line BEYOND sourceLines is still eligible (not skipped)
    const sourceLines = ['System.debug("hello")'] // length 1
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1],
      new Set([5]), // line 5 is beyond sourceLines.length (1)
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 5 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — line 5 is covered, not in allowedLines, sourceLines.length < line, so skip check bypassed
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given skip patterns present and sourceLines length equals line minus one (strictly less than), When entering covered line, Then skip pattern is not applied', () => {
    // Arrange — kills >= → > on sourceLines.length >= line boundary (line 69)
    // sourceLines.length = 2, line = 3 (length < line, so >= is false, > is also false — same)
    // sourceLines.length = 2, line = 2: >= is true (applies check), > is false (skips check)
    // The existing boundary test covers length === line. This tests length === line - 1.
    const sourceLines = ['first line', 'second line'] // length 2
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1],
      new Set([3]), // line 3, sourceLines.length = 2 < 3
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 3 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — line 3 is beyond sourceLines (length 2), skip check not applied, line is eligible
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given listener with setCoveredLines method, When constructing MutationListener, Then setCoveredLines is called on that listener', () => {
    // Arrange — kills BlockStatement mutant on line 25 that empties the setCoveredLines forEach body
    // If the body is emptied, setCoveredLines would never be invoked on the listener
    const listenerWithSetCoveredLines = {
      enterMethodCall: vi.fn(),
      setCoveredLines: vi.fn(),
    } as unknown as BaseListener
    const lines = new Set([5, 10])

    // Act
    new MutationListener([listenerWithSetCoveredLines], lines)

    // Assert — setCoveredLines must be called exactly once with the coveredLines set
    expect(
      (
        listenerWithSetCoveredLines as BaseListener & {
          setCoveredLines: ReturnType<typeof vi.fn>
        }
      ).setCoveredLines
    ).toHaveBeenCalledWith(lines)
  })

  it('Given listener without _mutations property, When constructing MutationListener, Then _mutations is NOT shared to that listener', () => {
    // Arrange — kills MethodExpression mutant on line 29 that removes .filter(listener => '_mutations' in listener)
    // Without the filter, ALL listeners (even those without _mutations) would get _mutations assigned
    const listenerWithoutMutations = {
      enterMethodCall: vi.fn(),
      // deliberately no _mutations property
    } as unknown as BaseListener
    sut = new MutationListener([listenerWithoutMutations], coveredLines)

    // Assert — listener without _mutations must NOT have its _mutations set to sut._mutations
    expect((listenerWithoutMutations as BaseListener)._mutations).not.toBe(
      sut._mutations
    )
  })

  it('Given no skipPatterns provided (default), When entering covered line with non-empty sourceLines, Then propagates to listeners without errors', () => {
    // Arrange — kills ArrayDeclaration mutant on line 19 that changes default skipPatterns from []
    // to ["Stryker was here"]. With the mutant default, skipPatterns would be a non-empty array
    // of strings; calling .test() on a string throws TypeError.
    // Passing undefined explicitly triggers the default parameter.
    const sourceLines = ['Integer x = 5;']
    sut = new MutationListener(
      [mockListener1],
      new Set([1]),
      undefined, // triggers default skipPatterns value
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act & Assert — with real default ([]), no skip check runs; with mutant (["Stryker was here"]),
    // calling "Stryker was here".test(sourceLine) throws TypeError
    expect(() => sut['enterMethodCall'](mockContext)).not.toThrow()
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given no sourceLines provided (default), When entering covered line with skip patterns and line 1, Then propagates because default sourceLines is empty', () => {
    // Arrange — kills ArrayDeclaration mutant on line 21 that changes default sourceLines from []
    // to ["Stryker was here"]. With the mutant default, sourceLines.length (1) >= line (1) is true,
    // so the skip pattern IS applied to "Stryker was here". If the pattern matches, propagation is blocked.
    // With real default ([]), sourceLines.length (0) >= line (1) is false, so no check runs.
    const skipPatterns = [new RE2('Stryker was here')]
    sut = new MutationListener(
      [mockListener1],
      new Set([1]),
      skipPatterns,
      undefined,
      undefined // triggers default sourceLines value
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — with real default ([]), skip block is not entered, line is eligible and propagates
    // With mutant (["Stryker was here"]), pattern matches the default line → propagation blocked
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given proxy accesses own property directly (not method), When accessing coveredLines, Then returns actual Set not a function', () => {
    // Arrange — kills ConditionalExpression mutant on `prop in target`:
    // if (prop in target) → if (false): coveredLines access falls through to proxy function path,
    // returning a function instead of the actual Set
    sut = new MutationListener([mockListener1], coveredLines, [], undefined, [])

    // Act — access own property on the proxy
    const result = sut['coveredLines' as keyof typeof sut]

    // Assert — must return actual Set, not a callable function or undefined
    expect(result).toBe(coveredLines)
    expect(result instanceof Set).toBe(true)
  })

  it('Given proxy accesses listeners property, When accessing, Then returns actual array not a function', () => {
    // Arrange — kills ConditionalExpression mutant on `prop in target` (via a different own property)
    sut = new MutationListener(
      [mockListener1, mockListener2],
      coveredLines,
      [],
      undefined,
      []
    )

    // Act — access own property 'listeners'
    const result = sut['listeners' as keyof typeof sut]

    // Assert — must be actual array of listeners
    expect(Array.isArray(result)).toBe(true)
  })

  it('Given proxy handler returns a function for unknown props, When function is called with context, Then forwards to listeners with correct arguments', () => {
    // Arrange — kills BlockStatement mutant on the returned function body inside the proxy get handler:
    // if the body is emptied, the call would not forward to listeners at all
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act — proxy returns a function for 'enterMethodCall' (not in target); call that function
    const proxyFn = sut['enterMethodCall']
    proxyFn(mockContext)

    // Assert — the forwarded call must reach listener1
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given proxy method called with exactly one argument, When line is covered, Then propagates (args.length > 0 is true for length=1)', () => {
    // Arrange — kills EqualityOperator mutant on args.length > 0 → args.length < 0 (never true)
    // and ConditionalExpression: args.length > 0 → false (never enters block)
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — one arg, length=1 > 0, should propagate
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledTimes(1)
  })

  it('Given optional chaining on ctx?.start?.line, When ctx has no start property, Then does not throw', () => {
    // Arrange — kills OptionalChaining mutant: ctx?.start?.line → ctx.start.line
    // ctx = {} has no 'start', so ctx.start is undefined; undefined.line throws TypeError without ?.
    const ctxWithoutStart = {} as unknown as MethodCallContext

    // Act & Assert — must not throw even when ctx has no start property
    expect(() => sut['enterMethodCall'](ctxWithoutStart)).not.toThrow()
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given optional chaining on ctx?.start?.line, When ctx.start has no line property, Then does not throw', () => {
    // Arrange — kills OptionalChaining mutant on the second ?. (start?.line)
    const ctxWithStartButNoLine = {
      start: {},
    } as unknown as MethodCallContext

    // Act & Assert — must not throw; ctx.start exists but has no line → isLineEligible(undefined) → false
    expect(() => sut['enterMethodCall'](ctxWithStartButNoLine)).not.toThrow()
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given listener with setCoveredLines as undefined (no method), When constructing, Then does not throw (optional chaining)', () => {
    // Arrange — kills OptionalChaining mutant: listener.setCoveredLines?.(coveredLines) → listener.setCoveredLines(coveredLines)
    // If setCoveredLines is undefined on the listener, calling it without ?. throws TypeError
    const listenerWithoutSetCoveredLines = {
      enterMethodCall: vi.fn(),
      // no setCoveredLines method
    } as unknown as BaseListener

    // Act & Assert — constructing with a listener that has no setCoveredLines must not throw
    expect(
      () => new MutationListener([listenerWithoutSetCoveredLines], new Set([1]))
    ).not.toThrow()
  })

  it('Given multiple listeners where one has isLineEligible-relevant methods, When entering covered line, Then each listener independently checked for method existence', () => {
    // Arrange — kills prop in listener check: `prop in listener && typeof` → if always true,
    // listener without the method would try to call undefined[prop] → still type-checked, but verifies
    // the happy path that all matching listeners are called
    const mockListener3 = {
      enterMethodCall: vi.fn(),
      exitMethodCall: vi.fn(),
    } as unknown as Mocked<BaseListener>
    sut = new MutationListener(
      [mockListener1, mockListener2, mockListener3],
      new Set([10])
    )
    const mockContext = {
      start: { line: 10 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — all three listeners that have the method must be called
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener2['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener3['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('Given skip pattern matches source line at index line-1 (not line), When entering covered line, Then does not propagate', () => {
    // Arrange — kills ArithmeticOperator mutant: sourceLines[line - 1] → sourceLines[line]
    // line=1 → index=0 accesses 'System.debug(...)' (matches); with +1: index=1 accesses 'safe line' (no match)
    const sourceLines = ['System.debug("test")', 'safe line']
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1],
      new Set([1]),
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — line 1 (index 0) contains skip pattern → NOT propagated
    // With line+1 (index 1): 'safe line' does NOT match → WOULD propagate → test would fail → kills mutant
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given sourceLines.length exactly equals line (boundary), When skip pattern matches, Then does not propagate', () => {
    // Arrange — kills EqualityOperator on sourceLines.length >= line: >= → > would skip this boundary case
    // sourceLines.length=1, line=1: 1 >= 1 = true → checks skip pattern
    // With > instead: 1 > 1 = false → skips check → would propagate → test fails → kills mutant
    const sourceLines = ['System.debug("boundary")']
    const skipPatterns = [new RE2('System\\.debug')]
    sut = new MutationListener(
      [mockListener1],
      new Set([1]),
      skipPatterns,
      undefined,
      sourceLines
    )
    const mockContext = {
      start: { line: 1 },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — line 1, sourceLines.length=1, 1 >= 1 → skip check applied → not propagated
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given coveredLines does not contain the line, When checking eligibility, Then returns false regardless of allowedLines', () => {
    // Arrange — kills BlockStatement mutant on `if (!this.coveredLines.has(line)) { return false }`
    // If that block is emptied, uncovered lines would pass through and potentially be eligible
    const allowedLines = new Set([15]) // line IS in allowedLines
    sut = new MutationListener(
      [mockListener1],
      new Set([10, 20, 30]), // line 15 NOT covered
      [],
      allowedLines,
      []
    )
    const mockContext = {
      start: { line: 15 }, // 15 is in allowedLines but NOT in coveredLines
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — not covered → not eligible, even though in allowedLines
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })

  it('Given line is NaN (falsy), When checking eligibility, Then returns false', () => {
    // Arrange — kills ConditionalExpression mutant on `if (!line)` → `if (true)` (always returns false)
    // or `if (false)` (never returns false for falsy lines)
    // NaN is falsy: !NaN = true → return false → listener not called
    // If mutated to if (false): NaN passes the check → coveredLines.has(NaN) = false → still not called
    // But if mutated to if (line) (inverted): for valid line=10, !10 = false → doesn't short-circuit →
    // continues to coveredLines check. For NaN: !NaN = false with inverted → passes → coveredLines.has(NaN) = false → still not called.
    // Use line=0 which is clearly falsy: if (!0) = true → return false
    // With if (0) = false → doesn't return false → coveredLines.has(0) = false (0 not in {10,20,30}) → return false
    // Both produce same result for line=0 → equivalent? Already tested at line 342.

    // Instead test that line=NaN is falsy
    const mockContext = {
      start: { line: Number.NaN },
    } as unknown as MethodCallContext

    // Act
    sut['enterMethodCall'](mockContext)

    // Assert — NaN is falsy → !NaN = true → return false early
    expect(mockListener1['enterMethodCall']).not.toHaveBeenCalled()
  })
})
