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

      expect(result).toContainEqual(
        expect.objectContaining({
          mutationName: 'IncrementMutator',
          replacement: '--',
        })
      )
      expect(result).toContainEqual(
        expect.objectContaining({
          mutationName: 'BoundaryConditionMutator',
          replacement: '<=',
        })
      )
      expect(result).toContainEqual(
        expect.objectContaining({
          mutationName: 'RemoveIncrementsMutator',
          replacement: 'i',
        })
      )
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

      // Assert - + generates 3 mutations: -, *, /
      expect(result).toHaveLength(3)
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
      const warnSpy = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined)

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['ArithmeticOperator', 'NonExistentMutator'],
      })

      // Assert - + generates 3 mutations: -, *, /
      expect(result).toHaveLength(3)
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

      // Assert - + generates 3 mutations: -, *, /
      expect(result).toHaveLength(3)
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

    it('Given include filter with empty names array, When computing mutations, Then returns all mutations (nameSet.size === 0 guard)', () => {
      // Arrange — kills the "nameSet.size === 0" → "nameSet.size !== 0" mutant
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])

      // Act — include with empty array has nameSet.size === 0, so all mutators should run
      const withEmptyInclude = sut.compute(
        classContent,
        coveredLines,
        undefined,
        {
          include: [],
        }
      )
      const withoutFilter = new MutantGenerator().compute(
        classContent,
        coveredLines
      )

      // Assert — empty include should behave like no filter
      expect(withEmptyInclude.length).toBe(withoutFilter.length)
    })

    it('Given exclude filter with empty names array, When computing mutations, Then returns all mutations', () => {
      // Arrange — exercises the exclude path of the Boolean(mutatorFilter.include) check
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])

      // Act — exclude with empty array has nameSet.size === 0, so all mutators should run
      const withEmptyExclude = sut.compute(
        classContent,
        coveredLines,
        undefined,
        {
          exclude: [],
        }
      )
      const withoutFilter = new MutantGenerator().compute(
        classContent,
        coveredLines
      )

      // Assert — empty exclude should behave like no filter
      expect(withEmptyExclude.length).toBe(withoutFilter.length)
    })

    it('Given excludeMutators resulting in zero mutators, When computing mutations, Then throws error', () => {
      // Arrange — kills Boolean(mutatorFilter.include) mutant: with exclude, isInclude=false so !match filters
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])
      // Exclude ALL known mutators to cause "all excluded" error
      const allMutatorNames = [
        'ArgumentPropagation',
        'ArithmeticOperator',
        'ArithmeticOperatorDeletion',
        'BitwiseOperator',
        'BoundaryCondition',
        'ConstructorCall',
        'EmptyReturn',
        'EqualityCondition',
        'ExperimentalSwitch',
        'FalseReturn',
        'Increment',
        'InlineConstant',
        'InvertNegatives',
        'LogicalOperator',
        'LogicalOperatorDeletion',
        'MemberVariable',
        'NakedReceiver',
        'Negation',
        'NonVoidMethodCall',
        'NullReturn',
        'RemoveConditionals',
        'RemoveIncrements',
        'Switch',
        'TrueReturn',
        'UnaryOperatorInsertion',
        'VoidMethodCall',
      ]

      // Act & Assert
      expect(() =>
        sut.compute(classContent, coveredLines, undefined, {
          exclude: allMutatorNames,
        })
      ).toThrow('All mutators have been excluded by configuration')
    })

    it('Given excludeMutators with a single mutator, When computing mutations, Then excluded mutator is absent and others are present', () => {
      // Arrange — kills isInclude ? match : !match → isInclude ? match : match (same result for include/exclude)
      // With exclude mode, the excluded mutator must NOT appear; if isInclude were always true it would
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act
      const resultWithExclude = sut.compute(
        classContent,
        coveredLines,
        undefined,
        { exclude: ['ArithmeticOperator'] }
      )
      const resultWithAll = new MutantGenerator().compute(
        classContent,
        coveredLines
      )

      // Assert — excluding ArithmeticOperator gives fewer mutations than including all
      expect(resultWithExclude.length).toBeLessThan(resultWithAll.length)
      expect(
        resultWithExclude.every(
          m => m.mutationName !== 'ArithmeticOperatorMutator'
        )
      ).toBe(true)
    })

    it('Given no mutatorFilter at all, When computing mutations, Then returns all mutators (kills !mutatorFilter → false mutant)', () => {
      // Arrange — kills if (!mutatorFilter) → if (false): without the early-return, undefined filter
      // would fall through to the nameSet logic and set names=[], skip warning, then filter with empty set
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act — no mutatorFilter argument
      const resultNoFilter = sut.compute(classContent, coveredLines)
      // explicit undefined is the same code path
      const resultUndefinedFilter = new MutantGenerator().compute(
        classContent,
        coveredLines,
        undefined,
        undefined
      )

      // Assert — both must return same result (all mutators)
      expect(resultNoFilter.length).toBe(resultUndefinedFilter.length)
      expect(resultNoFilter.length).toBeGreaterThan(0)
    })

    it('Given includeMutators with one mutator, When computing mutations, Then only that mutator produces mutations (kills isInclude=false mutant)', () => {
      // Arrange — kills Boolean(mutatorFilter.include) → false: if isInclude were always false,
      // include mode would behave like exclude (returning everything EXCEPT the named mutator)
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['BoundaryCondition'],
      })

      // Assert — BoundaryCondition on "1 + 2" produces 0 mutations (no boundary operators)
      // but the point is ALL mutations must come from BoundaryConditionMutator
      expect(
        result.every(m => m.mutationName === 'BoundaryConditionMutator')
      ).toBe(true)
    })

    it('Given warnUnknownMutators with only known names, When computing mutations, Then no warning is emitted', () => {
      // Arrange — kills !knownNames.has(name) → knownNames.has(name) mutation
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])
      const warnSpy = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined)

      // Act — only known mutator names, no unknown
      sut.compute(classContent, coveredLines, undefined, {
        include: ['ArithmeticOperator'],
      })

      // Assert — no warning should be emitted for known mutators
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('Given include filter with mixed-case mutator name, When computing mutations, Then names are lowercased before matching (kills n.toLowerCase() → n mutant)', () => {
      // Arrange — kills `n.toLowerCase()` → `n` mutant:
      // Without toLowerCase, 'ArithmeticOperator' stored as-is would not match 'arithmeticoperator'
      // (the lowercased registry name), producing 0 mutations instead of 3.
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act — mixed-case include name (same as registry name before lowercasing)
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['ArithmeticOperator'],
      })

      // Assert — must produce mutations (3 for +: -, *, /)
      expect(result).toHaveLength(3)
    })

    it('Given include filter with all-uppercase mutator name, When computing mutations, Then names are lowercased and match (kills n.toLowerCase() → n mutant)', () => {
      // Arrange — kills `n.toLowerCase()` → `n` mutant using fully uppercase name.
      // Without toLowerCase, 'ARITHMETICOPERATOR' would not match 'arithmeticoperator'.
      const classContent =
        'public class Test { public static Integer method() { return 1 + 2; } }'
      const coveredLines = new Set([1])

      // Act
      const result = sut.compute(classContent, coveredLines, undefined, {
        include: ['ARITHMETICOPERATOR'],
      })

      // Assert — must produce mutations; lowercase matching means ARITHMETICOPERATOR = arithmeticoperator
      expect(result).toHaveLength(3)
      expect(
        result.every(m => m.mutationName === 'ArithmeticOperatorMutator')
      ).toBe(true)
    })

    it('Given exclude filter uses include path when include is undefined (kills ?? order mutant)', () => {
      // Arrange — kills `mutatorFilter.include ?? mutatorFilter.exclude ?? []` mutant
      // where the ?? chain is reordered. With exclude only, it should use excludeMutators path.
      const classContent =
        'public class Test { public static void method() { integer i = 0; ++i; } }'
      const coveredLines = new Set([1])

      // Act — exclude with known name
      const withExclude = sut.compute(classContent, coveredLines, undefined, {
        exclude: ['Increment'],
      })
      const withAll = new MutantGenerator().compute(classContent, coveredLines)

      // Assert — result must differ (Increment mutations removed)
      expect(withExclude.length).toBeLessThan(withAll.length)
      expect(
        withExclude.every(m => m.mutationName !== 'IncrementMutator')
      ).toBe(true)
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
      expect(result).toContainEqual(
        expect.objectContaining({ mutationName: 'InlineConstantMutator' })
      )
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

    it('Given multiline content and skip pattern, When computing, Then sourceLines split correctly matches pattern on specific line (kills classContent.split mutation)', () => {
      // Arrange — kills `classContent.split('\\n')` → `classContent.split('')` mutation:
      // With split(''), sourceLines is an array of individual characters, not lines.
      // The skip pattern 'debug' would not match a single character, so line 3 would
      // NOT be skipped — mutations on line 3 would appear, breaking the first assertion.
      const classContent = [
        'public class Test {',
        '  public static void method() {',
        '    System.debug(5 < 10);',
        '    Integer j = 5 < 10 ? 1 : 0;',
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

      // Assert — line 3 (System.debug call) must be skipped; line 4 must produce mutations
      expect(result.every(m => m.target.startToken.line !== 3)).toBe(true)
      expect(result.some(m => m.target.startToken.line === 4)).toBe(true)
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
