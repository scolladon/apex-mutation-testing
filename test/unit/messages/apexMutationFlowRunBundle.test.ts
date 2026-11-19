import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { Messages } from '@salesforce/core'

// Loads the real bundle, the way the command does: a key renamed in
// messages/apex.mutation.flow.run.md but not in the code — or the reverse —
// fails here instead of throwing MissingMessageError on a failure path no
// happy-path run exercises.
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

const SOURCES = [
  'src/commands/apex/mutation/flow/run.ts',
  'src/flow/FlowMutationOrchestrator.ts',
]

// Keys built from a template literal, expanded over every value they take.
const TEMPLATED_KEYS = [
  ...[
    'invalidXml',
    'notAFlow',
    'unsupportedProcessType',
    'deleteTriggered',
    'platformEventTriggered',
    'scheduleTriggered',
    'hasPauseElements',
    'hasScreenElements',
  ].map(reason => `error.flowInvalid.${reason}`),
  ...['Killed', 'Survived', 'CompileError', 'RuntimeError'].map(
    status => `info.mutantResult.${status}`
  ),
  ...['info.CommandIsRunning', 'info.DryRunCommandIsRunning'].map(
    prefix => `${prefix}AllTests`
  ),
]

// Keys the shared modules read from whatever bundle they are handed.
const SHARED_KEYS = [
  'error.invalidLineRange',
  'error.invalidLineRangeOrder',
  'error.reportDirOutsideCwd',
  'error.reportDirSymlinkOutsideCwd',
  'info.syncTransportFallback',
  'info.typeResolutionDegraded',
  // ConfigReader.resolveFlow
  'error.configFileUnreadable',
  'error.configFieldNotStringArray',
  'error.configEntryNotString',
  'error.configFieldNotNumber',
  'error.configFieldNotBoolean',
  'error.mutuallyExclusiveMutators',
  'error.thresholdOutOfRange',
]

// Every quoted string that reads like a bundle key: passed straight to
// getMessage/createError, or returned as the key of a rendered error.
const literalKeys = (): string[] =>
  SOURCES.flatMap(file =>
    Array.from(
      readFileSync(path.resolve(file), 'utf8').matchAll(
        /'((?:error|info|flags)\.[A-Za-z][A-Za-z.-]*|summary|description|examples)'/g
      ),
      match => match[1]
    )
  )

describe('apex.mutation.flow.run message bundle', () => {
  it('Given every key the Flow command uses, When read from the real bundle, Then each one exists', () => {
    // Arrange
    const keys = [
      ...new Set([...literalKeys(), ...TEMPLATED_KEYS, ...SHARED_KEYS]),
    ]

    // Act
    const missing = keys.filter(key => !messages.messages.has(key))

    // Assert
    expect(keys.length).toBeGreaterThan(70)
    expect(keys).toEqual(
      expect.arrayContaining([
        'error.namespacedOrg',
        'error.flowDeployNotCompleted',
        'error.runtimeErrorStreak',
        'info.hasAsyncPath',
      ])
    )
    expect(missing).toEqual([])
  })

  it('Given the score, When rendered, Then it reads exactly like the Apex command', () => {
    // Act & Assert
    expect(
      messages.getMessage('info.CommandSuccess', ['66.66666666666667'])
    ).toBe('Mutation score: 66.66666666666667%')
  })
})
