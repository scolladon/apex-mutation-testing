import { ReturnTypeAwareBaseListener } from '../../../src/mutator/returnTypeAwareBaseListener.js'

describe('ReturnTypeAwareBaseListener', () => {
  let listener: ReturnTypeAwareBaseListener

  beforeEach(() => {
    listener = new ReturnTypeAwareBaseListener()
  })

  it('should return null when current method type is unknown', () => {
    // Act & Assert
    expect(listener['getCurrentMethodReturnTypeInfo']()).toBeNull()
  })
})
