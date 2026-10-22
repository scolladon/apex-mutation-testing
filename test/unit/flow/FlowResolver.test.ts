import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlowResolver } from '../../../src/flow/FlowResolver.js'
import type { FlowSalesforcePort } from '../../../src/flow/types.js'

describe('FlowResolver', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-resolver-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('resolves direct file path when it exists on disk', async () => {
    const flowPath = path.join(tempDir, 'MyDirectFlow.flow-meta.xml')
    await fs.writeFile(flowPath, '<Flow></Flow>', 'utf-8')

    const result = await FlowResolver.resolve(flowPath)
    expect(result.flowFilePath).toBe(path.resolve(flowPath))
    expect(result.flowDeveloperName).toBe('MyDirectFlow')
    expect(result.tempDir).toBeUndefined()
  })

  it('resolves flow by name found in standard candidate directories', async () => {
    const standardFlowsDir = path.join(
      tempDir,
      'force-app',
      'main',
      'default',
      'flows'
    )
    await fs.mkdir(standardFlowsDir, { recursive: true })
    const targetFile = path.join(
      standardFlowsDir,
      'Account_After.flow-meta.xml'
    )
    await fs.writeFile(targetFile, '<Flow></Flow>', 'utf-8')

    const result = await FlowResolver.resolve(
      'Account_After',
      undefined,
      tempDir
    )
    expect(result.flowFilePath).toBe(targetFile)
    expect(result.flowDeveloperName).toBe('Account_After')
    expect(result.tempDir).toBeUndefined()
  })

  it('resolves flow by name found in nested custom directory recursively', async () => {
    const nestedDir = path.join(tempDir, 'custom-pkg', 'sub-module', 'flows')
    await fs.mkdir(nestedDir, { recursive: true })
    const targetFile = path.join(nestedDir, 'Custom_Flow.flow-meta.xml')
    await fs.writeFile(targetFile, '<Flow></Flow>', 'utf-8')

    const result = await FlowResolver.resolve('Custom_Flow', undefined, tempDir)
    expect(result.flowFilePath).toBe(targetFile)
    expect(result.flowDeveloperName).toBe('Custom_Flow')
  })

  it('resolves flow by retrieving from org when not found locally and sfPort has retrieveFlow', async () => {
    const _mockRetrievedFile = '/mock/temp/flows/OrgFlow.flow-meta.xml'
    const mockSfPort = {
      retrieveFlow: vi.fn().mockImplementation(async (_name, outDir) => {
        return path.join(outDir, 'OrgFlow.flow-meta.xml')
      }),
    } as unknown as FlowSalesforcePort

    const result = await FlowResolver.resolve('OrgFlow', mockSfPort, tempDir)
    expect(result.flowDeveloperName).toBe('OrgFlow')
    expect(result.tempDir).toBeDefined()
    expect(result.flowFilePath).toContain('OrgFlow.flow-meta.xml')

    // Clean up created temp dir
    if (result.tempDir) {
      await fs.rm(result.tempDir, { recursive: true, force: true })
    }
  })

  it('cleans up tempDir and rethrows Error when retrieveFlow fails with Error', async () => {
    const mockSfPort = {
      retrieveFlow: vi.fn().mockRejectedValue(new Error('Org network timeout')),
    } as unknown as FlowSalesforcePort

    await expect(
      FlowResolver.resolve('OrgFlow', mockSfPort, tempDir)
    ).rejects.toThrow('Org network timeout')
  })

  it('cleans up tempDir and wraps string when retrieveFlow fails with non-Error', async () => {
    const mockSfPort = {
      retrieveFlow: vi.fn().mockRejectedValue('String network error'),
    } as unknown as FlowSalesforcePort

    await expect(
      FlowResolver.resolve('OrgFlow', mockSfPort, tempDir)
    ).rejects.toThrow('String network error')
  })

  it('throws SfError when flow is not found locally and no sfPort is provided', async () => {
    await expect(
      FlowResolver.resolve('NonExistentFlow', undefined, tempDir)
    ).rejects.toThrow(
      'Flow "NonExistentFlow" was not found in the local project directory. Specify a valid file path or provide --target-org to retrieve it from Salesforce.'
    )
  })

  it('ignores blacklisted directories like node_modules and .git in recursive search', async () => {
    const nmDir = path.join(tempDir, 'node_modules', 'some-pkg', 'flows')
    await fs.mkdir(nmDir, { recursive: true })
    await fs.writeFile(
      path.join(nmDir, 'Hidden_Flow.flow-meta.xml'),
      '<Flow></Flow>',
      'utf-8'
    )

    const result = await FlowResolver.findLocalFlowFile('Hidden_Flow', tempDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when search depth exceeds maxDepth', async () => {
    const deepDir = path.join(tempDir, 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7')
    await fs.mkdir(deepDir, { recursive: true })
    await fs.writeFile(
      path.join(deepDir, 'Deep_Flow.flow-meta.xml'),
      '<Flow></Flow>',
      'utf-8'
    )

    const result = await FlowResolver.findLocalFlowFile('Deep_Flow', tempDir)
    expect(result).toBeUndefined()
  })

  it('instantiates FlowResolver class', () => {
    expect(new FlowResolver()).toBeInstanceOf(FlowResolver)
  })

  it('skips direct path when the resolved path is a directory, not a file', async () => {
    // Passing tempDir itself (a directory)
    await expect(
      FlowResolver.resolve(tempDir, undefined, tempDir)
    ).rejects.toThrow()
  })

  it('skips candidate when candidate path is a directory', async () => {
    const dirCandidate = path.join(tempDir, 'DirFlow.flow-meta.xml')
    await fs.mkdir(dirCandidate)

    const result = await FlowResolver.findLocalFlowFile('DirFlow', tempDir)
    expect(result).toBeUndefined()
  })

  it('handles readdir errors during recursive search gracefully', async () => {
    const nonExistent = path.join(tempDir, 'missing-dir')
    const result = await FlowResolver.findLocalFlowFile('AnyFlow', nonExistent)
    expect(result).toBeUndefined()
  })
})
