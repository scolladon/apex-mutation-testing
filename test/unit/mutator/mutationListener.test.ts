import { MethodCallContext } from 'apex-parser'
import { BaseListener } from '../../../src/mutator/baseListener.js'
import { MutationListener } from '../../../src/mutator/mutationListener.js'
import { ReturnTypeAwareBaseListener } from '../../../src/mutator/returnTypeAwareBaseListener.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'

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

  it('should set typeTable only on ReturnTypeAwareBaseListener instances', () => {
    // Arrange
    const typeAwareListener = new ReturnTypeAwareBaseListener()
    const plainListener = new BaseListener()
    const typeTable = new Map<string, ApexMethod>()
    typeTable.set('test', {
      returnType: 'Integer',
      startLine: 1,
      endLine: 5,
      type: ApexType.INTEGER,
    })

    // Act
    new MutationListener(
      [typeAwareListener, plainListener],
      coveredLines,
      typeTable
    )

    // Assert
    expect(typeAwareListener['typeTable']).toBe(typeTable)
    expect(
      (plainListener as unknown as Record<string, unknown>)['typeTable']
    ).toBeUndefined()
  })

  it('should handle proxy method called with no arguments', () => {
    // Act & Assert
    expect(() => sut['someUnknownMethod']()).not.toThrow()
  })

  describe('Given always-forwarded methods for type tracking', () => {
    it.each([
      'enterLocalVariableDeclaration',
      'enterFormalParameter',
      'enterFieldDeclaration',
      'enterEnhancedForControl',
    ])('should forward %s regardless of coverage', method => {
      // Arrange
      const listener = {
        [method]: jest.fn(),
      } as unknown as jest.Mocked<BaseListener>
      const uncoveredLine = 999
      const listenerInstance = new MutationListener([listener], coveredLines)

      const mockContext = {
        start: { line: uncoveredLine },
      } as unknown as MethodCallContext

      // Act
      listenerInstance[method](mockContext)

      // Assert
      expect(listener[method]).toHaveBeenCalledWith(mockContext)
    })
  })
})
