import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Messages, SfError } from '@salesforce/core'
import type { FlowSalesforcePort } from './types.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.flow.run'
)

export interface ResolvedFlow {
  flowFilePath: string
  flowDeveloperName: string
  tempDir?: string
}

export class FlowResolver {
  public static async resolve(
    flowInput: string,
    sfPort?: FlowSalesforcePort,
    startDir: string = process.cwd()
  ): Promise<ResolvedFlow> {
    const cleanInput = flowInput.trim()
    const isPathLike =
      cleanInput.endsWith('.xml') ||
      cleanInput.includes('/') ||
      cleanInput.includes('\\')

    const flowDeveloperName = isPathLike
      ? path
          .basename(cleanInput)
          .replace(/\.flow(-meta\.xml)?$/, '')
          .replace(/\.xml$/, '')
      : cleanInput

    try {
      const resolvedPath = path.resolve(cleanInput)
      const stat = await fs.stat(resolvedPath)
      if (stat.isFile()) {
        return {
          flowFilePath: resolvedPath,
          flowDeveloperName,
        }
      }
    } catch {
      // not a direct file path on disk
    }

    const localFile = await FlowResolver.findLocalFlowFile(
      flowDeveloperName,
      startDir
    )
    if (localFile) {
      return {
        flowFilePath: localFile,
        flowDeveloperName,
      }
    }

    if (sfPort?.retrieveFlow) {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'flow-mutation-retrieve-')
      )
      try {
        const retrievedPath = await sfPort.retrieveFlow(
          flowDeveloperName,
          tempDir
        )
        return {
          flowFilePath: retrievedPath,
          flowDeveloperName,
          tempDir,
        }
      } catch (err: unknown) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
        throw err instanceof Error ? err : new Error(String(err))
      }
    }

    throw new SfError(
      messages.getMessage('error.flowNotFoundLocally', [flowDeveloperName])
    )
  }

  public static async findLocalFlowFile(
    flowDeveloperName: string,
    startDir: string = process.cwd()
  ): Promise<string | undefined> {
    const targetFileName = `${flowDeveloperName}.flow-meta.xml`

    const candidates = [
      path.join(
        startDir,
        'force-app',
        'main',
        'default',
        'flows',
        targetFileName
      ),
      path.join(startDir, 'force-app', 'flows', targetFileName),
      path.join(startDir, 'src', 'flows', targetFileName),
      path.join(startDir, 'flows', targetFileName),
      path.join(startDir, targetFileName),
    ]

    for (const candidate of candidates) {
      try {
        const stat = await fs.stat(candidate)
        if (stat.isFile()) {
          return candidate
        }
      } catch {
        // file doesn't exist at this candidate path
      }
    }

    return FlowResolver.searchFileRecursively(startDir, targetFileName, 0, 5)
  }

  private static async searchFileRecursively(
    currentDir: string,
    targetFileName: string,
    currentDepth: number,
    maxDepth: number
  ): Promise<string | undefined> {
    if (currentDepth > maxDepth) return undefined

    const ignoredDirs = new Set([
      'node_modules',
      '.git',
      '.wireit',
      'dist',
      'lib',
      'reports',
      'mutations',
      '.sf',
      '.sfdx',
      '.nyc_output',
      'test',
    ])

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      const subDirs: string[] = []

      for (const entry of entries) {
        if (
          entry.isFile() &&
          entry.name.toLowerCase() === targetFileName.toLowerCase()
        ) {
          return path.join(currentDir, entry.name)
        }
        if (entry.isDirectory() && !ignoredDirs.has(entry.name)) {
          subDirs.push(path.join(currentDir, entry.name))
        }
      }

      for (const subDir of subDirs) {
        const found = await FlowResolver.searchFileRecursively(
          subDir,
          targetFileName,
          currentDepth + 1,
          maxDepth
        )
        if (found) return found
      }
    } catch {
      // directory read failure, skip
    }

    return undefined
  }
}
