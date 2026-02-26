import { MethodCallContext } from 'apex-parser'
import * as RE2 from 're2'
import { BaseListener } from '../../../src/mutator/baseListener.js'
import { MutationListener } from '../../../src/mutator/mutationListener.js'

describe('MutationListener', () => {
  // Arrange
  let mockListener1: jest.Mocked<BaseListener>
  let mockListener2: jest.Mocked<BaseListener>
  let sut: MutationListener
  let coveredLines: Set<number>

  beforeEach(() => {
    mockListener1 = {
      enterMethodCall: jest.fn(),
      exitMethodCall: jest.fn(),
    } as unknown as jest.Mocked<BaseListener>

    mockListener2 = {
      enterMethodCall: jest.fn(),
      exitMethodCall: jest.fn(),
    } as unknown as jest.Mocked<BaseListener>

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
    } as unknown as jest.Mocked<BaseListener>
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
})
