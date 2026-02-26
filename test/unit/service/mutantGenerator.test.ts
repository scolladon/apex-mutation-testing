import RE2 from 're2'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'

describe('MutantGenerator', () => {
  let sut: MutantGenerator

  beforeEach(() => {
    sut = new MutantGenerator()
  })

  describe('when computing mutations', () => {
    it('should return mutations for increment operator on covered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1]) // Line 1 is covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      const incrementMutations = result.filter(
        m => m.mutationName === 'IncrementMutator'
      )
      expect(incrementMutations).toHaveLength(1)
      expect(incrementMutations[0].replacement).toEqual('--')
    })

    it('should return mutations for comparison operator on covered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static boolean method() { return 5 < 10; } }'
      const coveredLines = new Set([1]) // Line 1 is covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      const boundaryMutations = result.filter(
        m => m.mutationName === 'BoundaryConditionMutator'
      )
      expect(boundaryMutations).toHaveLength(1)
      expect(boundaryMutations[0].replacement).toEqual('<=')
    })

    it('should return mutations for inline constants on covered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { Integer i = 42; } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      const inlineConstantMutations = result.filter(
        m => m.mutationName === 'InlineConstantMutator'
      )
      expect(inlineConstantMutations.length).toBeGreaterThanOrEqual(1)
      const replacements = inlineConstantMutations.map(m => m.replacement)
      expect(replacements).toContain('0')
    })

    it('should return empty array for uncovered lines', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([2]) // Line 1 is not covered

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert
      expect(result).toHaveLength(0)
    })

    it('should handle multiple mutations on same line', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { for(integer i = 0; i < 10; ++i){} } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines)

      // Assert - at least 3 mutations: < -> <=, ++ -> --, ++i -> i
      expect(result.length).toBeGreaterThanOrEqual(3)

      const incrementMutation = result.find(
        m => m.mutationName === 'IncrementMutator'
      )
      const boundaryMutation = result.find(
        m => m.mutationName === 'BoundaryConditionMutator'
      )
      const removeIncrementsMutation = result.find(
        m => m.mutationName === 'RemoveIncrementsMutator'
      )

      expect(incrementMutation).toBeDefined()
      expect(incrementMutation?.replacement).toBe('--')

      expect(boundaryMutation).toBeDefined()
      expect(boundaryMutation?.replacement).toBe('<=')

      expect(removeIncrementsMutation).toBeDefined()
      expect(removeIncrementsMutation?.replacement).toBe('i')
    })
  })

  describe('when filtering mutators', () => {
    it('Given includeMutators with ArithmeticOperator, When computing mutations on arithmetic code, Then only ArithmeticOperatorMutator mutations are returned', () => {
      // Arrange
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['ArithmeticOperator'],
      })

      // Assert
      expect(result.length).toBeGreaterThan(0)
      expect(
        result.every(m => m.mutationName === 'ArithmeticOperatorMutator')
      ).toBe(true)
    })

    it('Given excludeMutators with Increment, When computing mutations on increment code, Then IncrementMutator mutations are excluded', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        exclude: ['Increment'],
      })

      // Assert
      expect(result.every(m => m.mutationName !== 'IncrementMutator')).toBe(
        true
      )
    })

    it('Given includeMutators with unknown name, When computing mutations, Then unknown name is skipped and warning emitted', () => {
      // Arrange
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])
      const warnSpy = jest
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined)

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['ArithmeticOperator', 'NonExistentMutator'],
      })

      // Assert
      expect(result.length).toBeGreaterThan(0)
      expect(
        result.every(m => m.mutationName === 'ArithmeticOperatorMutator')
      ).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith(
        "Unknown mutator name: 'nonexistentmutator' — skipping"
      )
      warnSpy.mockRestore()
    })

    it('Given includeMutators resulting in zero mutators, When computing mutations, Then throws error', () => {
      // Arrange
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act & Assert
      expect(() =>
        sut.compute(classContent, coveredLines, undefined, {
          include: ['NonExistentMutator'],
        })
      ).toThrow('All mutators have been excluded by configuration')
    })

    it('Given case-insensitive mutator name, When computing mutations, Then matches correctly', () => {
      // Arrange
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['arithmeticoperator'],
      })

      // Assert
      expect(result.length).toBeGreaterThan(0)
      expect(
        result.every(m => m.mutationName === 'ArithmeticOperatorMutator')
      ).toBe(true)
    })

    it('Given empty mutator filter, When computing mutations, Then returns all mutations', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])

      // Act
      const withFilter = sut.compute(classContent, coveredLines, undefined, {})
      const withoutFilter = new MutantGenerator().compute(
        classContent,
        coveredLines
      )

      // Assert
      expect(withFilter.length).toBe(withoutFilter.length)
    })
  })

  describe('getTokenStream', () => {
    it('Given no compute called, When calling getTokenStream, Then returns undefined', () => {
      // Arrange & Act
      const result = sut.getTokenStream()

      // Assert
      expect(result).toBeUndefined()
    })

    it('Given compute called, When calling getTokenStream, Then returns token stream', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      sut.compute(classContent, new Set([1]))

      // Act
      const result = sut.getTokenStream()

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('when filtering by lines', () => {
    it('Given lines filter, When computing mutations, Then only mutations on allowed lines are returned', () => {
      // Arrange
      const classContent = [
        'public class Test {',
        '  public static void method() {',
        '    Integer i = 0;',
        '    ++i;',
        '  }',
        '}',
      ].join('\n')
      const coveredLines = new Set([3, 4])
      const allowedLines = new Set([3])

      // Act
      const result = sut.compute(
        classContent,
        coveredLines,
        undefined,
        undefined,
        [],
        allowedLines
      )

      // Assert
      expect(result.length).toBeGreaterThan(0)
      expect(result.every(m => m.target.startToken.line === 3)).toBe(true)
    })
  })

  describe('when filtering by skip patterns', () => {
    it('Given skip pattern matching a line, When computing mutations, Then mutations on that line are excluded', () => {
      // Arrange
      const classContent = [
        'public class Test {',
        '  public static void method() {',
        '    System.debug(x);',
        '    ++i;',
        '  }',
        '}',
      ].join('\n')
      const coveredLines = new Set([3, 4])
      const skipPatterns = [new RE2('System\\.debug')]

      // Act
      const result = sut.compute(
        classContent,
        coveredLines,
        undefined,
        undefined,
        skipPatterns
      )

      // Assert
      expect(result.every(m => m.target.startToken.line !== 3)).toBe(true)
    })
  })

  describe('when mutating code', () => {
    it('should return mutated code with increment replacement applied', () => {
      // Arrange
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])
      const mutations = sut.compute(classContent, coveredLines)
      const incrementMutation = mutations.find(
        m => m.mutationName === 'IncrementMutator'
      )!

      // Act
      const result = sut.mutate(incrementMutation)

      // Assert
      expect(result).toContain('--i;')
      expect(result).not.toContain('++i;')
    })

    it('should return mutated code with boundary replacement applied', () => {
      // Arrange
      const classContent =
        'public class Test { public static boolean method() { return 5 < 10; } }'
      const coveredLines = new Set([1])
      const mutations = sut.compute(classContent, coveredLines)
      const boundaryMutation = mutations.find(
        m => m.mutationName === 'BoundaryConditionMutator'
      )!

      // Act
      const result = sut.mutate(boundaryMutation)

      // Assert
      expect(result).toContain('5 <= 10')
      expect(result).not.toContain('5 < 10')
    })
  })
})
