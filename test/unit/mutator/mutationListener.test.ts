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
})
