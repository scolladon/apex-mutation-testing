import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { formatRemainingTime } from '../service/timeUtils.js'
import { FlowValidator } from './FlowValidator.js'
import { getDefaultFlowMutators } from './mutators/index.js'
import type {
  FlowMutant,
  FlowMutantStatus,
  FlowMutationReport,
  FlowMutator,
  FlowOrchestratorCallbacks,
  FlowSalesforcePort,
  FlowTestRunResult,
} from './types.js'

export interface OrchestratorOptions {
  flowFilePath: string
  flowDeveloperName: string
  flowTests?: string[]
  apexTests?: string[]
  lines?: string[]
  dryRun?: boolean
  callbacks?: FlowOrchestratorCallbacks
}

export class FlowMutationOrchestrator {
  private readonly mutators: FlowMutator[]

  public constructor(
    private readonly sfPort: FlowSalesforcePort,
    customMutators?: FlowMutator[]
  ) {
    this.mutators = customMutators ?? getDefaultFlowMutators()
  }

  public async run(options: OrchestratorOptions): Promise<FlowMutationReport> {
    const originalXml = await this.readAndValidateFlow(options)
    const mutants = this.generateMutants(originalXml, options)

    if (options.dryRun || mutants.length === 0) {
      return this.buildReport(options.flowFilePath, mutants, originalXml)
    }

    const isOriginallyActive = /<status>\s*Active\s*<\/status>/i.test(
      originalXml
    )
    const originalFlowTestContents = new Map<string, string>()
    let tempDraftFlowId: string | undefined
    let deployDurationMs = 0

    try {
      if (isOriginallyActive) {
        const activeRes = await this.prepareActiveFlowVersion(
          options,
          originalXml,
          originalFlowTestContents
        )
        tempDraftFlowId = activeRes.flowId
        deployDurationMs = activeRes.deployDurationMs
      } else {
        const deployRes = await this.deployBaselineDraftFlow(
          options,
          originalXml
        )
        deployDurationMs = deployRes.deployDurationMs
      }

      const baselineRes = await this.verifyBaselineTests(options)
      options.callbacks?.onTimeEstimate?.(
        deployDurationMs,
        baselineRes.testDurationMs,
        mutants.length,
        mutants.length
      )

      await this.evaluateMutants(
        options,
        mutants,
        isOriginallyActive,
        baselineRes.testsRan
      )
    } finally {
      await this.rollbackToOriginalState(
        options,
        originalXml,
        originalFlowTestContents,
        tempDraftFlowId
      )
    }

    return this.buildReport(options.flowFilePath, mutants, originalXml)
  }

  private async readAndValidateFlow(
    options: OrchestratorOptions
  ): Promise<string> {
    const originalXml = await fs.readFile(options.flowFilePath, 'utf-8')
    options.callbacks?.onValidating?.()
    const validation = FlowValidator.validate(originalXml)
    if (!validation.isValid) {
      throw new Error(
        `Flow validation failed for ${options.flowDeveloperName}: ${validation.errorMessage}`
      )
    }
    options.callbacks?.onValidated?.()
    return originalXml
  }

  private generateMutants(
    originalXml: string,
    options: OrchestratorOptions
  ): FlowMutant[] {
    options.callbacks?.onMutantsGenerating?.()
    let rawMutants = this.mutators.flatMap(m => m.mutate(originalXml))
    const allowedLines = this.parseLineRanges(options.lines)
    if (allowedLines) {
      rawMutants = rawMutants.filter(
        m => m.lineNumber === undefined || allowedLines.has(m.lineNumber)
      )
    }
    const mutants: FlowMutant[] = rawMutants.map((m, idx) => ({
      ...m,
      id: `FLOW-MUT-${idx + 1}`,
      status: 'Pending' as FlowMutantStatus,
    }))
    options.callbacks?.onMutantsGenerated?.(mutants.length)
    return mutants
  }

  private async prepareActiveFlowVersion(
    options: OrchestratorOptions,
    originalXml: string,
    originalFlowTestContents: Map<string, string>
  ): Promise<{ flowId?: string; deployDurationMs: number }> {
    const deactivatedXml = await this.deactivateActiveFlow(options, originalXml)
    const deployStart = performance.now()
    await this.triggerDraftVersionCreation(options, deactivatedXml)
    const deployDurationMs = performance.now() - deployStart

    const latest = await this.sfPort.getLatestFlowVersion(
      options.flowDeveloperName
    )
    await this.synchronizeFlowTests(
      options,
      latest.versionNumber,
      originalFlowTestContents
    )
    return { flowId: latest.flowId, deployDurationMs }
  }

  private async deactivateActiveFlow(
    options: OrchestratorOptions,
    originalXml: string
  ): Promise<string> {
    const deactivatedXml = originalXml.replace(
      /<status>\s*Active\s*<\/status>/i,
      '<status>Draft</status>'
    )
    const deactDeploy = await this.sfPort.deployFlowXml(
      options.flowFilePath,
      deactivatedXml
    )
    if (!deactDeploy.success) {
      throw new Error(
        `Failed to deactivate active Flow "${options.flowDeveloperName}": ${deactDeploy.errorMessage}`
      )
    }
    return deactivatedXml
  }

  private async triggerDraftVersionCreation(
    options: OrchestratorOptions,
    deactivatedXml: string
  ): Promise<void> {
    let triggerNewVersionXml: string
    if (/<description>[\s\S]*?<\/description>/i.test(deactivatedXml)) {
      triggerNewVersionXml = deactivatedXml.replace(
        /<description>([\s\S]*?)<\/description>/i,
        (_, desc) => `<description>${desc} Mutating</description>`
      )
    } else {
      triggerNewVersionXml = deactivatedXml.replace(
        /<status>/i,
        '<description>Mutating</description>\n    <status>'
      )
    }
    const triggerDeploy = await this.sfPort.deployFlowXml(
      options.flowFilePath,
      triggerNewVersionXml
    )
    if (!triggerDeploy.success) {
      throw new Error(
        `Failed to create draft Flow version for "${options.flowDeveloperName}": ${triggerDeploy.errorMessage}`
      )
    }
  }

  private async synchronizeFlowTests(
    options: OrchestratorOptions,
    newVersionNumber: number,
    originalFlowTestContents: Map<string, string>
  ): Promise<void> {
    const flowTestFiles = await this.findFlowTestFiles(
      options.flowFilePath,
      options.flowDeveloperName
    )
    const updatedFlowTestFiles: string[] = []
    for (const ftPath of flowTestFiles) {
      const ftContent = await fs.readFile(ftPath, 'utf-8')
      originalFlowTestContents.set(ftPath, ftContent)
      const updatedContent = ftContent.replace(
        /<flowVersionNumber>\s*\d+\s*<\/flowVersionNumber>/g,
        `<flowVersionNumber>${newVersionNumber}</flowVersionNumber>`
      )
      await fs.writeFile(ftPath, updatedContent, 'utf-8')
      updatedFlowTestFiles.push(ftPath)
    }

    if (updatedFlowTestFiles.length > 0) {
      const ftDeploy = await this.sfPort.deployFiles(updatedFlowTestFiles)
      if (!ftDeploy.success) {
        throw new Error(
          `Failed to deploy updated FlowTests: ${ftDeploy.errorMessage}`
        )
      }
    }
  }

  private async deployBaselineDraftFlow(
    options: OrchestratorOptions,
    originalXml: string
  ): Promise<{ deployDurationMs: number }> {
    options.callbacks?.onBaselineDeploying?.()
    const deployStart = performance.now()
    const baselineDeploy = await this.sfPort.deployFlowXml(
      options.flowFilePath,
      originalXml
    )
    const deployDurationMs = performance.now() - deployStart
    if (!baselineDeploy.success) {
      throw new Error(
        `Baseline Flow deployment failed: ${baselineDeploy.errorMessage}`
      )
    }
    options.callbacks?.onBaselineDeployed?.()
    return { deployDurationMs }
  }

  private async verifyBaselineTests(
    options: OrchestratorOptions
  ): Promise<{ testDurationMs: number; testsRan: number }> {
    options.callbacks?.onBaselineTesting?.()
    const testStart = performance.now()
    const baselineTests = await this.executeTests(options)
    const testDurationMs = performance.now() - testStart
    if (!baselineTests.allPassed) {
      throw new Error(
        `Baseline tests failed before mutation started: ${baselineTests.failingMethods.join(', ')}`
      )
    }
    options.callbacks?.onBaselineTested?.('Original tests passed')
    return {
      testDurationMs,
      testsRan: baselineTests.testsRan ?? 0,
    }
  }

  private async evaluateMutants(
    options: OrchestratorOptions,
    mutants: FlowMutant[],
    isOriginallyActive: boolean,
    baselineTestsRan: number
  ): Promise<void> {
    options.callbacks?.onProgressStart?.(mutants.length)
    const loopStartTime = performance.now()
    const testCount =
      options.flowTests?.length ||
      options.apexTests?.length ||
      baselineTestsRan ||
      1

    for (let i = 0; i < mutants.length; i++) {
      const mutant = mutants[i]
      const remainingText = formatRemainingTime(
        loopStartTime,
        i,
        mutants.length
      )
      const mutantLabel = this.formatMutantLabel(mutant)
      const lineText = mutant.lineNumber ? ` at line ${mutant.lineNumber}` : ''

      options.callbacks?.onProgressUpdate?.(
        i,
        `${remainingText}Deploying "${mutantLabel}" mutation${lineText}`
      )

      let mutantXml = mutant.mutatedXml
      if (isOriginallyActive) {
        mutantXml = mutantXml.replace(
          /<status>\s*Active\s*<\/status>/i,
          '<status>Draft</status>'
        )
      }

      const deployResult = await this.sfPort.deployFlowXml(
        options.flowFilePath,
        mutantXml
      )

      let progressResultMsg: string

      if (!deployResult.success) {
        mutant.status = 'CompileError'
        progressResultMsg = `Mutation result: compile error${lineText}`
      } else {
        options.callbacks?.onProgressUpdate?.(
          i,
          `${remainingText}Running ${testCount} tests methods for "${mutantLabel}" mutation${lineText}`
        )
        const testResult = await this.executeTests(options)
        if (!testResult.allPassed) {
          mutant.status = 'Killed'
          mutant.killedBy = testResult.failingMethods
          progressResultMsg = 'Mutation result: mutant killed'
        } else {
          mutant.status = 'Survived'
          progressResultMsg = 'Mutation result: zombie'
        }
      }

      const updatedRemainingText = formatRemainingTime(
        loopStartTime,
        i + 1,
        mutants.length
      )
      options.callbacks?.onProgressUpdate?.(
        i + 1,
        `${updatedRemainingText}${progressResultMsg}`
      )
    }

    options.callbacks?.onProgressFinish?.('All mutations evaluated')
  }

  private formatMutantLabel(mutant: FlowMutant): string {
    const rawSnippet = (
      mutant.mutatedSnippet ||
      mutant.description ||
      mutant.elementName
    )
      .trim()
      .replace(/\s+/g, ' ')
    return rawSnippet.length > 40 ? `${rawSnippet.slice(0, 37)}...` : rawSnippet
  }

  private async rollbackToOriginalState(
    options: OrchestratorOptions,
    originalXml: string,
    originalFlowTestContents: Map<string, string>,
    tempDraftFlowId?: string
  ): Promise<void> {
    options.callbacks?.onRollbackStarting?.()
    let rollbackFailed = false
    try {
      await fs.writeFile(options.flowFilePath, originalXml, 'utf-8')
      const flowRollback = await this.sfPort.deployFlowXml(
        options.flowFilePath,
        originalXml
      )
      if (!flowRollback.success) {
        rollbackFailed = true
      }

      if (originalFlowTestContents.size > 0) {
        const ftPaths: string[] = []
        for (const [ftPath, ftContent] of originalFlowTestContents.entries()) {
          await fs.writeFile(ftPath, ftContent, 'utf-8')
          ftPaths.push(ftPath)
        }
        const ftRollback = await this.sfPort.deployFiles(ftPaths)
        if (!ftRollback.success) {
          rollbackFailed = true
        }
      }

      if (tempDraftFlowId && this.sfPort.deleteFlowVersion) {
        try {
          await this.sfPort.deleteFlowVersion(tempDraftFlowId)
        } catch {
          // Best-effort cleanup
        }
      }
    } catch {
      rollbackFailed = true
    } finally {
      options.callbacks?.onRollbackFinished?.(rollbackFailed)
    }
  }

  private async findFlowTestFiles(
    flowFilePath: string,
    flowApiName: string
  ): Promise<string[]> {
    const matchingFiles: string[] = []
    const candidateDirs: string[] = []

    const flowDir = path.dirname(flowFilePath)
    const siblingFlowTestsDir = path.resolve(flowDir, '..', 'flowtests')
    try {
      const stat = await fs.stat(siblingFlowTestsDir)
      if (stat.isDirectory()) {
        candidateDirs.push(siblingFlowTestsDir)
      }
    } catch {
      // Sibling flowtests folder doesn't exist
    }

    const projectRoot = path.resolve(flowDir, '..', '..', '..', '..')
    const defaultFlowTestsDir = path.resolve(
      projectRoot,
      'force-app',
      'main',
      'default',
      'flowtests'
    )
    if (!candidateDirs.includes(defaultFlowTestsDir)) {
      try {
        const stat = await fs.stat(defaultFlowTestsDir)
        if (stat.isDirectory()) {
          candidateDirs.push(defaultFlowTestsDir)
        }
      } catch {
        // Root flowtests folder doesn't exist
      }
    }

    for (const dir of candidateDirs) {
      try {
        const files = await fs.readdir(dir)
        for (const file of files) {
          if (file.endsWith('.flowtest-meta.xml')) {
            const fullPath = path.join(dir, file)
            const content = await fs.readFile(fullPath, 'utf-8')
            if (content.includes(`<flowApiName>${flowApiName}</flowApiName>`)) {
              matchingFiles.push(fullPath)
            }
          }
        }
      } catch {
        // Folder cannot be read
      }
    }

    return matchingFiles
  }

  private parseLineRanges(lines?: string[]): Set<number> | undefined {
    if (!lines || lines.length === 0) return undefined
    const allowed = new Set<number>()
    for (const lineEntry of lines) {
      if (lineEntry.includes('-')) {
        const [startStr, endStr] = lineEntry.split('-')
        const start = Number.parseInt(startStr, 10)
        const end = Number.parseInt(endStr, 10)
        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
          throw new Error(`Invalid line range: '${lineEntry}'`)
        }
        for (let l = start; l <= end; l++) {
          allowed.add(l)
        }
      } else {
        const lineNum = Number.parseInt(lineEntry, 10)
        if (Number.isNaN(lineNum)) {
          throw new Error(`Invalid line number: '${lineEntry}'`)
        }
        allowed.add(lineNum)
      }
    }
    return allowed
  }

  private async executeTests(
    options: OrchestratorOptions
  ): Promise<FlowTestRunResult> {
    if (options.apexTests && options.apexTests.length > 0) {
      return this.sfPort.runApexTests(options.apexTests)
    }
    return this.sfPort.runFlowTests(
      options.flowDeveloperName,
      options.flowTests
    )
  }

  private buildReport(
    flowFilePath: string,
    mutants: FlowMutant[],
    originalXml: string
  ): FlowMutationReport {
    const killed = mutants.filter(m => m.status === 'Killed').length
    const survived = mutants.filter(m => m.status === 'Survived').length
    const compileErrors = mutants.filter(
      m => m.status === 'CompileError'
    ).length
    const totalCovered = killed + survived
    const mutationScore =
      totalCovered > 0 ? Math.round((killed / totalCovered) * 100) : 0

    return {
      flowFilePath,
      totalMutants: mutants.length,
      killed,
      survived,
      compileErrors,
      mutationScore,
      mutants,
      originalXml,
    }
  }
}
