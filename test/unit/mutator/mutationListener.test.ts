import { BaseListener } from '../../../src/mutator/baseListener.js'
import { MutationListener } from '../../../src/mutator/mutationListener.js'

import { MethodCallContext } from 'apex-parser'

describe('MutationListener', () => {
  // Arrange
  let mockListener1: jest.Mocked<BaseListener>
  let mockListener2: jest.Mocked<BaseListener>
  let sut: MutationListener

  beforeEach(() => {
    mockListener1 = {
      enterMethodCall: jest.fn(),
      exitMethodCall: jest.fn(),
    } as unknown as jest.Mocked<BaseListener>

    mockListener2 = {
      enterMethodCall: jest.fn(),
      exitMethodCall: jest.fn(),
    } as unknown as jest.Mocked<BaseListener>

    sut = new MutationListener([mockListener1, mockListener2])
  })

  it('should propagate enter rule calls to all listeners', () => {
    // Act
    const mockContext = {} as MethodCallContext
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener2['enterMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('should propagate exit rule calls to all listeners', () => {
    // Act
    const mockContext = {} as MethodCallContext
    sut['exitMethodCall'](mockContext)

    // Assert
    expect(mockListener1['exitMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener2['exitMethodCall']).toHaveBeenCalledWith(mockContext)
  })

  it('should only call listeners that implement the method', () => {
    // Arrange
    const mockListener3 = {
      // Doesn't implement enterMethodCall
    } as unknown as jest.Mocked<BaseListener>
    sut = new MutationListener([mockListener1, mockListener3])

    // Act
    const mockContext = {} as MethodCallContext
    sut['enterMethodCall'](mockContext)

    // Assert
    expect(mockListener1['enterMethodCall']).toHaveBeenCalledWith(mockContext)
    expect(mockListener3['enterMethodCall']).toBeUndefined()
  })
})
