import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FlowHTMLReporter,
  findLocationInXml,
  resolveMutantLocationAndReplacement,
} from '../../../src/flow/reporter/FlowHTMLReporter.js'
import type { FlowMutationReport } from '../../../src/flow/types.js'

describe('FlowHTMLReporter', () => {
  let tempDir: string
  let sampleFlowFile: string
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <formulas>
        <name>TestFormula</name>
        <expression>'Hot'</expression>
    </formulas>
    <start>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <status>Active</status>
</Flow>`

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-report-test-'))
    sampleFlowFile = path.join(tempDir, 'Account_After.flow-meta.xml')
    await fs.writeFile(sampleFlowFile, sampleXml, 'utf-8')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('findLocationInXml finds location by line and snippet', () => {
    const loc = findLocationInXml(sampleXml, 'Create', 10)
    expect(loc.start.line).toBe(10)
    expect(loc.start.column).toBeGreaterThan(1)
    expect(loc.end.column).toBe(loc.start.column + 'Create'.length)
  })

  it('findLocationInXml falls back across lines if line not specified', () => {
    const loc = findLocationInXml(sampleXml, 'TestFormula')
    expect(loc.start.line).toBe(5)
  })

  it('findLocationInXml fallback when snippet not found', () => {
    const loc = findLocationInXml(sampleXml, 'NON_EXISTENT_SNIPPET')
    expect(loc.start.line).toBe(1)
  })

  it('handles XML entity escaping &apos; properly for formula string literals', () => {
    const xmlWithEntities = `<?xml version="1.0" encoding="UTF-8"?>
<Flow>
    <expression>&apos;Hot&apos;</expression>
</Flow>`
    const res = resolveMutantLocationAndReplacement(
      xmlWithEntities,
      "'Hot'",
      "''",
      3
    )
    expect(res.location.start.line).toBe(3)
    expect(res.location.start.column).toBe(17)
    expect(res.location.end.column).toBe(32)
    expect(res.replacement).toBe('&apos;&apos;')
  })

  it('generates HTML report and index.html file', async () => {
    const reporter = new FlowHTMLReporter()
    const reportDir = path.join(tempDir, 'mutations')

    const sampleReport: FlowMutationReport = {
      flowFilePath: sampleFlowFile,
      totalMutants: 2,
      killed: 1,
      survived: 1,
      compileErrors: 0,
      mutationScore: 50,
      originalXml: sampleXml,
      mutants: [
        {
          id: 'FLOW-MUT-1',
          mutatorName: 'RecordTriggerTypeMutator',
          elementName: '$Start',
          description: "Changed recordTriggerType from 'Create' to 'Update'",
          originalSnippet: 'Create',
          mutatedSnippet: 'Update',
          mutatedXml: sampleXml.replace('Create', 'Update'),
          status: 'Killed',
          lineNumber: 9,
          killedBy: ['TestFlow1'],
        },
        {
          id: 'FLOW-MUT-2',
          mutatorName: 'FormulaExpressionMutator',
          elementName: 'TestFormula',
          description: "Replaced string literal 'Hot' with ''",
          originalSnippet: "'Hot'",
          mutatedSnippet: "''",
          mutatedXml: sampleXml.replace("'Hot'", "''"),
          status: 'Survived',
          lineNumber: 6,
        },
      ],
    }

    const output = await reporter.generateReport(sampleReport, reportDir)
    expect(output).toBe(path.resolve(reportDir))

    const htmlContent = await fs.readFile(
      path.join(reportDir, 'index.html'),
      'utf-8'
    )
    expect(htmlContent).toContain('<mutation-test-report-app')
    expect(htmlContent).toContain('Account_After.flow-meta.xml')
    expect(htmlContent).toContain('FLOW-MUT-1')
    expect(htmlContent).toContain('FLOW-MUT-2')
    expect(htmlContent).toContain('RecordTriggerTypeMutator')
  })

  it('handles && escaping and &apos; replacement in resolveMutantLocationAndReplacement', () => {
    const xmlAmp = `<Flow><expression>&amp;&amp;</expression></Flow>`
    const resAmp = resolveMutantLocationAndReplacement(xmlAmp, '&&', '||', 1)
    expect(resAmp.location.start.column).toBe(19)

    const xmlApos = `<Flow><expression>'val'</expression></Flow>`
    const resApos = resolveMutantLocationAndReplacement(
      xmlApos,
      '&apos;val&apos;',
      "''",
      1
    )
    expect(resApos.location.start.column).toBe(19)
  })

  it('finds snippet on nearby lines within +/- 20 lines', () => {
    const lines = [
      '<Flow>',
      ...Array(10).fill('  <dummy/>'),
      '  <target>Value</target>',
      '</Flow>',
    ]
    const xml = lines.join('\n')
    const res = resolveMutantLocationAndReplacement(xml, 'Value', 'Mutated', 5)
    expect(res.location.start.line).toBe(12)
  })

  it('handles preferredLine out of bounds or empty whitespace lines in fallback', () => {
    const xml = '   \n   \n'
    const res1 = resolveMutantLocationAndReplacement(
      xml,
      'Missing',
      'Mutated',
      99
    )
    expect(res1.location.start.line).toBe(1)
    expect(res1.location.start.column).toBe(1)

    const res2 = resolveMutantLocationAndReplacement(
      xml,
      'Missing',
      'Mutated',
      undefined
    )
    expect(res2.location.start.line).toBe(1)

    const res3 = resolveMutantLocationAndReplacement(
      xml,
      'Missing',
      'Mutated',
      0
    )
    expect(res3.location.start.line).toBe(1)

    const res4 = resolveMutantLocationAndReplacement(
      xml,
      'Missing',
      'Mutated',
      -5
    )
    expect(res4.location.start.line).toBe(1)

    const res5 = resolveMutantLocationAndReplacement(
      '',
      'Missing',
      'Mutated',
      1
    )
    expect(res5.location.start.line).toBe(1)
  })

  it('reads from disk when originalXml is omitted, and handles read failure gracefully', async () => {
    const reporter = new FlowHTMLReporter()
    const reportDir = path.join(tempDir, 'mutations-disk')

    // 1. Reads from disk
    const reportWithoutXml: FlowMutationReport = {
      flowFilePath: sampleFlowFile,
      totalMutants: 0,
      killed: 0,
      survived: 0,
      compileErrors: 0,
      mutationScore: 100,
      mutants: [],
    }
    const out1 = await reporter.generateReport(reportWithoutXml, reportDir)
    expect(out1).toBe(path.resolve(reportDir))

    // 2. Read failure when file does not exist
    const reportNonExistent: FlowMutationReport = {
      flowFilePath: path.join(tempDir, 'non-existent.xml'),
      totalMutants: 0,
      killed: 0,
      survived: 0,
      compileErrors: 0,
      mutationScore: 100,
      mutants: [],
    }
    const out2 = await reporter.generateReport(
      reportNonExistent,
      path.join(tempDir, 'mutations-fail')
    )
    expect(out2).toBeDefined()
  })

  it('handles Pending mutants and empty killedBy correctly in transformFlowResults', async () => {
    const reporter = new FlowHTMLReporter()
    const report: FlowMutationReport = {
      flowFilePath: sampleFlowFile,
      totalMutants: 2,
      killed: 0,
      survived: 0,
      compileErrors: 0,
      mutationScore: 0,
      originalXml: sampleXml,
      mutants: [
        {
          id: 'MUT-PENDING',
          mutatorName: 'RecordTriggerTypeMutator',
          elementName: '$Start',
          description: 'Pending mutant',
          originalSnippet: 'Create',
          mutatedSnippet: 'Update',
          mutatedXml: sampleXml,
          status: 'Pending',
          killedBy: [],
        },
        {
          id: 'MUT-SURVIVED',
          mutatorName: 'RecordTriggerTypeMutator',
          elementName: '$Start',
          description: 'Survived mutant without killedBy',
          originalSnippet: 'Create',
          mutatedSnippet: 'Update',
          mutatedXml: sampleXml,
          status: 'Survived',
        },
      ],
    }

    const output = await reporter.generateReport(
      report,
      path.join(tempDir, 'mutations-pending')
    )
    expect(output).toBeDefined()
  })

  it('handles completely empty XML and empty report in generateReport', async () => {
    const reporter = new FlowHTMLReporter()
    const report: FlowMutationReport = {
      flowFilePath: '',
      totalMutants: 0,
      killed: 0,
      survived: 0,
      compileErrors: 0,
      mutationScore: 100,
      mutants: [],
    }
    const output = await reporter.generateReport(
      report,
      path.join(tempDir, 'mutations-empty')
    )
    expect(output).toBeDefined()
  })

  it('generates report using default output directory mutations', async () => {
    const reporter = new FlowHTMLReporter()
    const reportWithoutOutputDir: FlowMutationReport = {
      flowFilePath: sampleFlowFile,
      totalMutants: 0,
      killed: 0,
      survived: 0,
      compileErrors: 0,
      mutationScore: 100,
      mutants: [],
      originalXml: sampleXml,
    }
    const out = await reporter.generateReport(reportWithoutOutputDir)
    expect(out).toBe(path.resolve('mutations'))
  })
})
