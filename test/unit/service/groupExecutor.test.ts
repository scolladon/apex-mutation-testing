import { Messages } from '@salesforce/core'
import { Progress } from '@salesforce/sf-plugins-core'
import type { CommonTokenStream } from 'apex-parser'
import type { MutationTestBed } from '../../../src/port/mutationTestBed.js'
import { GroupExecutor } from '../../../src/service/groupExecutor.js'
import { MutantGenerator } from '../../../src/service/mutantGenerator.js'
import { MutationGroup } from '../../../src/service/mutationGrouper.js'
import { ApexMutation } from '../../../src/type/ApexMutation.js'
import type { ApexTestRunResult } from '../../../src/type/ApexTestRunResult.js'
import type { TestMethodId } from '../../../src/type/TestMethodId.js'

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
  classId: 'FooTest',
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
      CLASS_NAME,
      CLASS_BODY,
      {} as CommonTokenStream,
      testMethodsPerLine,
      { mutateMany: mutateManyMock } as unknown as MutantGenerator,
      {
        evaluate: vi.fn(async () => ({
          kind: 'executed' as const,
          result: await runTestMethodsMock(),
        })),
      } as unknown as MutationTestBed,
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
        outcome: 'Failed',
        tests: [
          testOf('testA', 'Fail'),
          testOf('testB', 'Pass'),
          testOf('testC', 'Fail'),
        ],
      } as unknown as ApexTestRunResult)
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

    it('When evaluating, Then the mutated body is handed to the bed', async () => {
      // Arrange
      const evaluateMock = vi.fn(async () => ({
        kind: 'executed' as const,
        result: await runTestMethodsMock(),
      }))
      const sut = new GroupExecutor(
        CLASS_NAME,
        CLASS_BODY,
        {} as CommonTokenStream,
        testMethodsPerLine,
        {
          mutateMany: vi.fn().mockReturnValue(MUTATED_BODY),
        } as unknown as MutantGenerator,
        { evaluate: evaluateMock } as unknown as MutationTestBed,
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
      expect(evaluateMock).toHaveBeenCalledWith(MUTATED_BODY, group.testMethods)
    })

    it('When a batch evaluation resolves not-compilable, Then the group recurses into singletons', async () => {
      // Arrange — a `not-compilable` verdict occupies the same "ambiguous
      // attribution" slot a thrown batch error previously held: it must
      // still force k>1 recursion, and each singleton retry classifies its
      // own outcome rather than the group being scored as a whole.
      const localUpdateMock = vi.fn()
      const localProgress = {
        start: vi.fn(),
        update: localUpdateMock,
        finish: vi.fn(),
      } as unknown as Progress
      const evaluateMock = vi.fn().mockResolvedValue({
        kind: 'not-compilable',
        detail: 'Deployment failed:\nsyntax error',
      })
      const sut = new GroupExecutor(
        CLASS_NAME,
        CLASS_BODY,
        {} as CommonTokenStream,
        testMethodsPerLine,
        {
          mutateMany: vi.fn().mockReturnValue(MUTATED_BODY),
        } as unknown as MutantGenerator,
        { evaluate: evaluateMock } as unknown as MutationTestBed,
        localProgress,
        { getMessage: vi.fn(() => 'fallback') } as unknown as Messages<string>
      )

      // Act
      const results = await sut.evaluate(group, 0, performance.now(), 12)

      // Assert
      expect(results.map(r => r.status)).toEqual([
        'CompileError',
        'CompileError',
        'CompileError',
      ])
      const infos = localUpdateMock.mock.calls.map(
        ([, payload]) => (payload as { info: string }).info
      )
      expect(infos).toContainEqual(expect.stringContaining('fallback'))
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
        outcome: 'Passed',
        tests: [testOf('testZ', 'Pass')],
      } as unknown as ApexTestRunResult)
      const sut = buildSut(testMethodsPerLine)

      // Act
      const results = await sut.evaluate(group, 0, performance.now(), 1)

      // Assert
      expect(results.map(r => r.status)).toEqual(['Survived'])
      expect(infoMessages()).toContainEqual(
        expect.stringContaining('Mutation result: zombie')
      )
    })

    it('Given a bed verdict carrying a French message and no recognisable prefix, When evaluating, Then the status is CompileError with the verdict detail as statusReason', async () => {
      // Arrange — a `not-compilable` verdict is the only signal that must
      // matter; the message is deliberately non-English and does not start
      // with the plugin's own English prefix.
      const frenchMessage = "Échec : la classe ne compile pas sur l'org cible"
      const sut = new GroupExecutor(
        CLASS_NAME,
        CLASS_BODY,
        {} as CommonTokenStream,
        testMethodsPerLine,
        {
          mutateMany: vi.fn().mockReturnValue(MUTATED_BODY),
        } as unknown as MutantGenerator,
        {
          evaluate: vi.fn().mockResolvedValue({
            kind: 'not-compilable',
            detail: frenchMessage,
          }),
        } as unknown as MutationTestBed,
        {
          start: vi.fn(),
          update: vi.fn(),
          finish: vi.fn(),
        } as unknown as Progress,
        { getMessage: vi.fn(() => 'fallback') } as unknown as Messages<string>
      )

      // Act
      const results = await sut.evaluate(group, 0, performance.now(), 1)

      // Assert
      expect(results.map(r => r.status)).toEqual(['CompileError'])
      expect(results.map(r => r.statusReason)).toEqual([frenchMessage])
    })

    it('Given a rejection whose message contains LIMIT_USAGE_FOR_NS but is a thrown error rather than a not-compilable verdict, When evaluating, Then the status is RuntimeError', async () => {
      // Arrange — pins the regression: message text alone must never classify a kill.
      runTestMethodsMock = vi
        .fn()
        .mockRejectedValue(
          new Error(
            'System.LimitException: LIMIT_USAGE_FOR_NS : Too many queries'
          )
        )
      const sut = buildSut(testMethodsPerLine)

      // Act
      const results = await sut.evaluate(group, 0, performance.now(), 1)

      // Assert
      expect(results.map(r => r.status)).toEqual(['RuntimeError'])
    })
  })

  describe('Given the mutant run reports a Fail row for the same class id as the baseline', () => {
    // The baseline mints its TestMethodId from a Pass row of TEST_CLASS_ID;
    // the mutant run reports a Fail row for the same class id. The join
    // must key on classId alone — the only identity a row carries.
    const TEST_CLASS_ID = '01pjV000000EE9bQAG'
    const mutation = mutationAt(9, 'K')
    const testMethodsPerLine = new Map<number, Set<TestMethodId>>([
      [9, new Set([`${TEST_CLASS_ID}.testRun`] as TestMethodId[])],
    ])
    const group: MutationGroup = {
      mutations: [mutation],
      testMethods: new Set([`${TEST_CLASS_ID}.testRun`] as TestMethodId[]),
    }

    it('When evaluating, Then the mutant is attributed Killed via the class id', async () => {
      // Arrange
      runTestMethodsMock = vi.fn().mockResolvedValue({
        outcome: 'Failed',
        tests: [
          {
            classId: TEST_CLASS_ID,
            methodName: 'testRun',
            outcome: 'Fail',
          },
        ],
      } as unknown as ApexTestRunResult)
      const sut = buildSut(testMethodsPerLine)

      // Act
      const results = await sut.evaluate(group, 0, performance.now(), 1)

      // Assert
      expect(results.map(r => r.status)).toEqual(['Killed'])
      expect(results[0].attribution).toEqual({
        coveredBy: [`${TEST_CLASS_ID}.testRun`],
        killedBy: [`${TEST_CLASS_ID}.testRun`],
        testsCompleted: 1,
      })
    })
  })
})
