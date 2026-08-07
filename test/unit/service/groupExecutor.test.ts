import { TestResult } from '@salesforce/apex-node'
import { Messages } from '@salesforce/core'
import { Progress } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import { ApexClassRepository } from '../../../src/adapter/apexClassRepository.js'
import { ApexTestRunner } from '../../../src/adapter/apexTestRunner.js'
import { GroupExecutor } from '../../../src/service/groupExecutor.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationGroup } from '../../../src/service/mutationGrouper.js'
import { ApexMutation } from '../../../src/type/ApexMutation.js'
import type { TestMethodId } from '../../../src/type/TestMethodId.js'

const CLASS_ID = 'class-id'
const CLASS_NAME = 'Mutation'
const CLASS_BODY = 'public class Mutation { }'
const MUTATED_BODY = 'public class Mutation { /* mutated */ }'

const mutationAt = (line: number, replacement: string): ApexMutation =>
  ({
    mutationName: `mut@${line}`,
    replacement,
    target: {
      startToken: {
        line,
        charPositionInLine: 0,
        startIndex: 0,
        stopIndex: 5,
        tokenIndex: line,
        text: 'public',
      },
      endToken: {
        line,
        charPositionInLine: 0,
        startIndex: 0,
        stopIndex: 5,
        tokenIndex: line,
        text: 'public',
      },
      text: 'public',
    },
  }) as unknown as ApexMutation

const testOf = (methodName: string, outcome: string) => ({
  apexClass: { fullName: 'FooTest' },
  methodName,
  outcome,
})

describe('GroupExecutor', () => {
  let progress: Progress
  let updateMock: ReturnType<typeof vi.fn>
  let runTestMethodsMock: ReturnType<typeof vi.fn>
  let mutateManyMock: ReturnType<typeof vi.fn>

  const infoMessages = (): string[] =>
    updateMock.mock.calls.map(
      ([, payload]) => (payload as { info: string }).info
    )

  const buildSut = (
    testMethodsPerLine: Map<number, Set<TestMethodId>>
  ): GroupExecutor => {
    updateMock = vi.fn()
    progress = {
      start: vi.fn(),
      update: updateMock,
      finish: vi.fn(),
    } as unknown as Progress
    mutateManyMock = vi.fn().mockReturnValue(MUTATED_BODY)
    return new GroupExecutor(
      { Id: CLASS_ID, Body: CLASS_BODY } as never,
      CLASS_NAME,
      CLASS_BODY,
      {} as CommonTokenStream,
      testMethodsPerLine,
      { mutateMany: mutateManyMock } as unknown as MutantGenerator,
      { runTestMethods: runTestMethodsMock } as unknown as ApexTestRunner,
      {
        update: vi.fn().mockResolvedValue({}),
      } as unknown as ApexClassRepository,
      progress,
      { getMessage: vi.fn(() => 'fallback') } as unknown as Messages<string>
    )
  }

  describe('Given a group of three mutations whose covering tests all report', () => {
    // Lines are deliberately out of order (7, 3, 11) so the announcement can
    // prove they are sorted numerically before being rendered.
    const mutationA = mutationAt(7, 'A')
    const mutationB = mutationAt(3, 'B')
    const mutationC = mutationAt(11, 'C')
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>([
      [7, new Set(['FooTest.testA'] as TestMethodId[])],
      [3, new Set(['FooTest.testB'] as TestMethodId[])],
      [11, new Set(['FooTest.testC'] as TestMethodId[])],
    ])
    const group: MutationGroup = {
      mutations: [mutationA, mutationB, mutationC],
      testMethods: new Set([
        'FooTest.testA',
        'FooTest.testB',
        'FooTest.testC',
      ] as TestMethodId[]),
    }

    beforeEach(() => {
      // testA and testC fail (their mutants are killed), testB passes (its
      // mutant survives) — an asymmetric 2/1 split so counting the wrong side
      // of the partition is visible.
      runTestMethodsMock = vi.fn().mockResolvedValue({
        summary: { outcome: 'Failed' },
        tests: [
          testOf('testA', 'Fail'),
          testOf('testB', 'Pass'),
          testOf('testC', 'Fail'),
        ],
      } as unknown as TestResult)
    })

    it('When evaluating, Then each mutation is attributed to its own covering test', async () => {
      // Arrange
      const sut = buildSut(testMethodsPerLine)

      // Act
      const results = await sut.evaluate(group, 5, performance.now(), 12)

      // Assert
      expect(results.map(r => r.status)).toEqual([
        'Killed',
        'Survived',
        'Killed',
      ])
      expect(results.map(r => r.mutatorName)).toEqual([
        'mut@7',
        'mut@3',
        'mut@11',
      ])
    })

    it('When announcing, Then the affected lines are listed in ascending numeric order', async () => {
      // Arrange
      const sut = buildSut(testMethodsPerLine)

      // Act
      await sut.evaluate(group, 5, performance.now(), 12)

      // Assert — numeric sort, not lexicographic and not input order
      expect(infoMessages()).toContainEqual(
        expect.stringContaining('Evaluating 3 mutations on lines 3, 7, 11')
      )
    })

    it('When the group completes, Then the summary counts killed and survived separately', async () => {
      // Arrange
      const sut = buildSut(testMethodsPerLine)

      // Act
      await sut.evaluate(group, 5, performance.now(), 12)

      // Assert — the 2/1 split makes counting the complement visible
      expect(infoMessages()).toContainEqual(
        expect.stringContaining('Group of 3 evaluated: 2 killed, 1 survived')
      )
    })

    it('When the group completes, Then progress advances by the group size', async () => {
      // Arrange — starting at 5 with a group of 3 lands on 8; subtracting
      // instead would report 2.
      const sut = buildSut(testMethodsPerLine)

      // Act
      await sut.evaluate(group, 5, performance.now(), 12)

      // Assert
      const positions = updateMock.mock.calls.map(([position]) => position)
      expect(positions[positions.length - 1]).toBe(8)
    })

    it('When deploying, Then the mutated body is pushed under the original class id', async () => {
      // Arrange
      const updateClassMock = vi.fn().mockResolvedValue({})
      const sut = new GroupExecutor(
        { Id: CLASS_ID, Body: CLASS_BODY } as never,
        CLASS_NAME,
        CLASS_BODY,
        {} as CommonTokenStream,
        testMethodsPerLine,
        {
          mutateMany: vi.fn().mockReturnValue(MUTATED_BODY),
        } as unknown as MutantGenerator,
        { runTestMethods: runTestMethodsMock } as unknown as ApexTestRunner,
        { update: updateClassMock } as unknown as ApexClassRepository,
        {
          start: vi.fn(),
          update: vi.fn(),
          finish: vi.fn(),
        } as unknown as Progress,
        { getMessage: vi.fn(() => 'fallback') } as unknown as Messages<string>
      )

      // Act
      await sut.evaluate(group, 0, performance.now(), 12)

      // Assert
      expect(updateClassMock).toHaveBeenCalledWith({
        Id: CLASS_ID,
        Body: MUTATED_BODY,
      })
    })
  })

  describe('Given a singleton group', () => {
    const mutation = mutationAt(4, 'Z')
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>([
      [4, new Set(['FooTest.testZ'] as TestMethodId[])],
    ])
    const group: MutationGroup = {
      mutations: [mutation],
      testMethods: new Set(['FooTest.testZ'] as TestMethodId[]),
    }

    it('When the mutation survives, Then the singleton summary is used rather than the group summary', async () => {
      // Arrange
      runTestMethodsMock = vi.fn().mockResolvedValue({
        summary: { outcome: 'Passed' },
        tests: [testOf('testZ', 'Pass')],
      } as unknown as TestResult)
      const sut = buildSut(testMethodsPerLine)

      // Act
      const results = await sut.evaluate(group, 0, performance.now(), 1)

      // Assert
      expect(results.map(r => r.status)).toEqual(['Survived'])
      expect(infoMessages()).toContainEqual(
        expect.stringContaining('Mutation result: zombie')
      )
    })
  })
})
