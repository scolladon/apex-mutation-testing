import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Messages } from '@salesforce/core'
import type { FlowMutant, FlowMutationResult } from '../../../src/flow/types.js'
import { FlowHTMLReporter } from '../../../src/reporter/FlowHTMLReporter.js'
import { recordTriggeredFlowXml } from '../../utils/flowFixtures.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

const mutant = (overrides: Partial<FlowMutant> = {}): FlowMutant => ({
  id: 'FLOW-MUT-1',
  mutatorName: 'RecordTriggerTypeMutator',
  elementName: '$Start',
  description: "Changed recordTriggerType from 'Create' to 'Update'",
  edits: [{ start: 1, end: 2, replacement: 'Update' }],
  status: 'Killed',
  killedBy: ['Sets_Rating'],
  location: { start: { line: 7, column: 28 }, end: { line: 7, column: 34 } },
  replacement: 'Update',
  ...overrides,
})

const result = (mutants: FlowMutant[]): FlowMutationResult => ({
  flowApiName: 'Account_After',
  sourceXml: recordTriggeredFlowXml(),
  mutants,
})

const readReportData = async (dir: string) => {
  const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8')
  const json = html.match(
    /<script id="mutation-report-data" type="application\/json">(.*)<\/script>/
  )![1]
  return JSON.parse(json)
}

describe('FlowHTMLReporter', () => {
  let cwd: string
  let reportDir: string

  beforeEach(async () => {
    cwd = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'flow-report-'))
    )
    reportDir = path.join(cwd, 'mutations')
    await fs.mkdir(reportDir)
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(cwd, { recursive: true, force: true })
  })

  it('Given mutants, When reported, Then each maps onto the shared schema with its exact location', async () => {
    // Arrange
    const sut = new FlowHTMLReporter(messages)

    // Act
    await sut.generateReport(
      result([
        mutant(),
        mutant({ id: 'FLOW-MUT-2', status: 'Survived', killedBy: [] }),
        mutant({
          id: 'FLOW-MUT-3',
          status: 'Pending',
          killedBy: undefined,
          statusReason: 'deploy refused',
        }),
      ]),
      'mutations'
    )

    // Assert
    const data = await readReportData(reportDir)
    const file = data.files['Account_After.flow-meta.xml']
    expect(data.schemaVersion).toBe('2.0.0')
    expect(file.language).toBe('xml')
    expect(file.source).toBe(recordTriggeredFlowXml())
    expect(file.mutants).toEqual([
      {
        id: 'FLOW-MUT-1',
        mutatorName: 'RecordTriggerTypeMutator',
        replacement: 'Update',
        status: 'Killed',
        statusReason: "Changed recordTriggerType from 'Create' to 'Update'",
        static: false,
        killedBy: ['Sets_Rating'],
        testsCompleted: 1,
        location: {
          start: { line: 7, column: 28 },
          end: { line: 7, column: 34 },
        },
      },
      expect.objectContaining({
        id: 'FLOW-MUT-2',
        status: 'Survived',
        testsCompleted: 1,
      }),
      expect.objectContaining({
        id: 'FLOW-MUT-3',
        statusReason: 'deploy refused',
        testsCompleted: 0,
      }),
    ])
    expect(file.mutants[1].killedBy).toBeUndefined()
  })

  it('Given a report dir outside cwd, When reporting, Then it refuses', async () => {
    // Arrange — review proof
    const sut = new FlowHTMLReporter(messages)
    const outside = path.join(os.tmpdir(), 'escaped')

    // Act
    const run = sut.generateReport(result([]), path.relative(cwd, outside))

    // Assert
    await expect(run).rejects.toThrow(
      /resolves outside the current working directory/
    )
  })
})
