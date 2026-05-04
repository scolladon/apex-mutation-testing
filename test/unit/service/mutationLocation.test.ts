import {
  calculateMutationPosition,
  extractMutationOriginalText,
} from '../../../src/service/mutationLocation.js'
import { ApexMutation } from '../../../src/type/ApexMutation.js'

describe('calculateMutationPosition', () => {
  it('given undefined startIndex when calculating then throws', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: undefined },
        endToken: { stopIndex: 10 },
        text: '42',
      },
    }

    // Act & Assert
    expect(() =>
      calculateMutationPosition(mutation as unknown as ApexMutation)
    ).toThrow('Failed to calculate position for mutation: TestMutation')
  })

  it('given undefined stopIndex when calculating then throws', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: 0 },
        endToken: { stopIndex: undefined },
        text: '42',
      },
    }

    // Act & Assert
    expect(() =>
      calculateMutationPosition(mutation as unknown as ApexMutation)
    ).toThrow('Failed to calculate position for mutation: TestMutation')
  })

  it('given a single-line span when calculating then reports start + end columns correctly', () => {
    // Arrange — token 'world' at line 1, col 7 (0-indexed 6)
    const mutation = {
      mutationName: 'TestMutation',
      replacement: 'foo',
      target: {
        startToken: {
          line: 1,
          charPositionInLine: 6,
          startIndex: 6,
          stopIndex: 10,
          text: 'world',
        },
        endToken: {
          line: 1,
          charPositionInLine: 6,
          startIndex: 6,
          stopIndex: 10,
          text: 'world',
        },
        text: 'world',
      },
    }

    // Act
    const result = calculateMutationPosition(
      mutation as unknown as ApexMutation
    )

    // Assert
    expect(result.start).toEqual({ line: 1, column: 7 })
    expect(result.end).toEqual({ line: 1, column: 12 })
  })

  it('given endToken text spanning a newline when calculating then end is on the next line', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: 'x',
      target: {
        startToken: {
          line: 1,
          charPositionInLine: 0,
          startIndex: 0,
          stopIndex: 10,
          text: 'line1\nline2',
        },
        endToken: {
          line: 1,
          charPositionInLine: 0,
          startIndex: 0,
          stopIndex: 10,
          text: 'line1\nline2',
        },
        text: 'line1\nline2',
      },
    }

    // Act
    const result = calculateMutationPosition(
      mutation as unknown as ApexMutation
    )

    // Assert
    expect(result.start).toEqual({ line: 1, column: 1 })
    expect(result.end).toEqual({ line: 2, column: 6 })
  })

  it('given an empty endToken text when calculating then end equals end-token start', () => {
    // Defensive: ANTLR can emit zero-width tokens; advancePosition must not
    // shift the cursor for an empty text.
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '',
      target: {
        startToken: {
          line: 3,
          charPositionInLine: 4,
          startIndex: 20,
          stopIndex: 24,
          text: 'hello',
        },
        endToken: {
          line: 3,
          charPositionInLine: 9,
          startIndex: 25,
          stopIndex: 25,
          text: '',
        },
        text: 'hello',
      },
    }

    // Act
    const result = calculateMutationPosition(
      mutation as unknown as ApexMutation
    )

    // Assert
    expect(result.start).toEqual({ line: 3, column: 5 })
    expect(result.end).toEqual({ line: 3, column: 10 })
  })
})

describe('extractMutationOriginalText', () => {
  it('given undefined startIndex when extracting then throws', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: undefined },
        endToken: { stopIndex: 10 },
        text: '42',
      },
    }

    // Act & Assert
    expect(() =>
      extractMutationOriginalText(
        mutation as unknown as ApexMutation,
        'class TestClass {}'
      )
    ).toThrow('Failed to extract original text for mutation: TestMutation')
  })

  it('given undefined stopIndex when extracting then throws', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: 0 },
        endToken: { stopIndex: undefined },
        text: '42',
      },
    }

    // Act & Assert
    expect(() =>
      extractMutationOriginalText(
        mutation as unknown as ApexMutation,
        'class TestClass {}'
      )
    ).toThrow('Failed to extract original text for mutation: TestMutation')
  })

  it('given empty source content when extracting then throws', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: 0 },
        endToken: { stopIndex: 5 },
        text: 'hello',
      },
    }

    // Act & Assert
    expect(() =>
      extractMutationOriginalText(mutation as unknown as ApexMutation, '')
    ).toThrow('Failed to extract original text for mutation: TestMutation')
  })

  it('given valid indices and source when extracting then returns the substring', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: 6 },
        endToken: { stopIndex: 10 },
        text: 'world',
      },
    }

    // Act
    const result = extractMutationOriginalText(
      mutation as unknown as ApexMutation,
      'hello world'
    )

    // Assert
    expect(result).toBe('world')
  })

  it('given indices at the very end when extracting then extracts last character correctly', () => {
    // Arrange
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: 2 },
        endToken: { stopIndex: 2 },
        text: 'c',
      },
    }

    // Act — substring(2, 2+1) = 'c'
    const result = extractMutationOriginalText(
      mutation as unknown as ApexMutation,
      'abc'
    )

    // Assert
    expect(result).toBe('c')
  })

  it('given valid indices and stopIndex+1 boundary when extracting then uses exclusive end', () => {
    // Arrange — 'hello world', startIndex=0, stopIndex=4 ⇒ substring(0, 5) = 'hello'
    const mutation = {
      mutationName: 'TestMutation',
      replacement: '0',
      target: {
        startToken: { startIndex: 0 },
        endToken: { stopIndex: 4 },
        text: 'hello',
      },
    }

    // Act
    const result = extractMutationOriginalText(
      mutation as unknown as ApexMutation,
      'hello world'
    )

    // Assert
    expect(result).toBe('hello')
  })
})
