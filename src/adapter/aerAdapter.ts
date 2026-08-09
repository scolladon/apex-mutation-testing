import { ChildProcess, exec, spawn } from 'node:child_process'
import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { TestResult } from '@salesforce/apex-node'
import { ApexClass } from '../type/ApexClass.js'

const execPromise = promisify(exec)

export class AerCommandBuilder {
  private sfProjectPath?: string
  private watchMode = false
  private skipErrors = false
  private jsonMode = false
  private coverageFile?: string
  private coverageFormat?: string
  private testClassName?: string
  private additionalFlags?: string

  public withProjectPath(projectPath: string): this {
    this.sfProjectPath = projectPath
    return this
  }

  public withWatch(watch = true): this {
    this.watchMode = watch
    return this
  }

  public withSkipErrors(skipErrors = true): this {
    this.skipErrors = skipErrors
    return this
  }

  public withJson(json = true): this {
    this.jsonMode = json
    return this
  }

  public withCoverage(coverageFile: string, format = 'cobertura'): this {
    this.coverageFile = coverageFile
    this.coverageFormat = format
    return this
  }

  public withTestClassName(testClassName?: string): this {
    this.testClassName = testClassName
    return this
  }

  public withAdditionalFlags(flags?: string): this {
    this.additionalFlags = flags
    return this
  }

  public buildArgs(): string[] {
    const args: string[] = ['test']
    if (this.sfProjectPath) {
      args.push(this.sfProjectPath)
    }
    if (this.watchMode) {
      args.push('--watch')
    }
    if (this.jsonMode) {
      args.push('--json')
    }
    if (this.skipErrors) {
      args.push('--skip-errors')
    }
    if (this.coverageFile) {
      args.push('--coverage', this.coverageFile)
      if (this.coverageFormat) {
        args.push('--coverage-format', this.coverageFormat)
      }
    }
    if (this.testClassName) {
      args.push('-f', this.testClassName)
    }
    if (this.additionalFlags) {
      args.push(...this.additionalFlags.trim().split(/\s+/))
    }
    return args
  }

  public buildCommandString(): string {
    const args = this.buildArgs()
    return `aer ${args.map(arg => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}`
  }
}

export async function findClassFile(
  dir: string,
  className: string
): Promise<string | undefined> {
  try {
    const files = await readdir(dir)
    for (const file of files) {
      const fullPath = join(dir, file)
      const fileStat = await stat(fullPath)
      if (fileStat.isDirectory()) {
        const found = await findClassFile(fullPath, className)
        if (found) return found
      } else if (file.toLowerCase() === `${className.toLowerCase()}.cls`) {
        return fullPath
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined
}

export class AerAdapter {
  public static async readClass(
    aerSfProjectPath: string,
    name: string,
    filePathsCache: Map<string, string>
  ): Promise<ApexClass | undefined> {
    let filePath = filePathsCache.get(name)
    if (!filePath) {
      filePath = await findClassFile(aerSfProjectPath, name)
      if (!filePath) {
        return undefined
      }
      filePathsCache.set(name, filePath)
    }
    const body = await readFile(filePath, 'utf-8')
    return {
      Id: name,
      Body: body,
      Name: name,
    } as unknown as ApexClass
  }

  public static async updateClass(
    aerSfProjectPath: string,
    apexClass: ApexClass,
    filePathsCache: Map<string, string>
  ): Promise<{ State: string }> {
    let filePath = filePathsCache.get(apexClass.Id as string)
    if (!filePath) {
      filePath = await findClassFile(aerSfProjectPath, apexClass.Id as string)
      if (!filePath) {
        throw new Error(
          `Apex class file for ${apexClass.Id} not found under ${aerSfProjectPath}`
        )
      }
      filePathsCache.set(apexClass.Id as string, filePath)
    }
    await writeFile(filePath, apexClass.Body, 'utf-8')
    return { State: 'Completed' }
  }

  public static async runBaselineTests(options: {
    aerSfProjectPath: string
    apexClassName: string
    apexTestClassName: string
    aerFlags?: string
  }): Promise<{
    outcome: string
    testsRan: number
    failing: number
    testMethodsPerLine: Map<number, Set<string>>
  }> {
    const { aerSfProjectPath, apexClassName, apexTestClassName, aerFlags } = options
    const coverageFile = join(process.cwd(), `coverage-${Date.now()}.xml`)

    const command = new AerCommandBuilder()
      .withProjectPath(aerSfProjectPath)
      .withSkipErrors()
      .withJson()
      .withCoverage(coverageFile, 'cobertura')
      .withTestClassName(apexTestClassName)
      .withAdditionalFlags(aerFlags)
      .buildCommandString()

    let stdout = ''
    let stderr = ''
    try {
      const result = await execPromise(command)
      stdout = result.stdout
      stderr = result.stderr
    } catch (error: any) {
      stdout = error.stdout || ''
      stderr = error.stderr || ''
      if (/type error:|parse error:|Skipped \d+ file/i.test(stdout + stderr)) {
        throw new Error(`Deployment failed:\n${stdout}\n${stderr}`)
      }
    }

    const tests: Array<{ methodName: string; outcome: string }> = []
    for (const line of stdout.split('\n')) {
      if (line.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.methodName) {
            tests.push({
              methodName: parsed.methodName,
              outcome: parsed.passed ? 'Pass' : 'Fail',
            })
          }
        } catch {
          // ignore
        }
      }
    }

    const testsRan = tests.length
    const failing = tests.filter(t => t.outcome !== 'Pass').length
    const outcome = failing === 0 && testsRan > 0 ? 'Passed' : 'Failed'

    const coveredLines: number[] = []
    try {
      const xmlContent = await readFile(coverageFile, 'utf-8')
      const escapedClassName = apexClassName.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        '\\$&'
      )
      const classRegex = new RegExp(
        `<class name="${escapedClassName}"[^>]*>([\\s\\S]*?)<\\/class>`,
        'i'
      )
      const classMatch = xmlContent.match(classRegex)
      if (classMatch) {
        const linesBlock = classMatch[1]
        const lineRegex = /<line number="(\d+)" hits="(\d+)"/g
        let match
        while ((match = lineRegex.exec(linesBlock)) !== null) {
          const lineNum = parseInt(match[1], 10)
          const hits = parseInt(match[2], 10)
          if (hits > 0) {
            coveredLines.push(lineNum)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      await unlink(coverageFile).catch(() => {})
    }

    const allMethodNames = new Set(tests.map(t => t.methodName))
    const testMethodsPerLine = new Map<number, Set<string>>()
    for (const line of coveredLines) {
      testMethodsPerLine.set(line, new Set(allMethodNames))
    }

    return {
      outcome,
      testsRan,
      failing,
      testMethodsPerLine,
    }
  }
}

export class AerWatchRunner {
  private watchProcess: ChildProcess | undefined
  private currentRunResolver: (() => void) | undefined
  private currentRunRejecter: ((err: Error) => void) | undefined
  private currentOutput = ''
  private currentTests: Array<{ methodName: string; outcome: string }> = []
  private completedRunsCount = 0

  constructor(
    private readonly aerSfProjectPath: string,
    private readonly apexTestClassName?: string,
    private readonly aerFlags?: string
  ) {}

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.watchProcess) {
        resolve()
        return
      }

      const args = new AerCommandBuilder()
        .withProjectPath(this.aerSfProjectPath)
        .withWatch()
        .withJson()
        .withSkipErrors()
        .withAdditionalFlags(this.aerFlags)
        .withTestClassName(this.apexTestClassName)
        .buildArgs()

      this.watchProcess = spawn('aer', args)

      let initialized = false
      let buffer = ''

      const handleData = (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          this.currentOutput += line + '\n'

          if (line.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(line)
              if (parsed.watchEvent) {
                if (parsed.watchEvent === 'runStarted') {
                  this.currentOutput = ''
                  this.currentTests = []
                } else if (parsed.watchEvent === 'runCompleted') {
                  this.completedRunsCount++
                  if (!initialized) {
                    initialized = true
                    resolve()
                  } else if (this.currentRunResolver) {
                    const resolveFn = this.currentRunResolver
                    this.currentRunResolver = undefined
                    this.currentRunRejecter = undefined
                    resolveFn()
                  }
                }
              } else if (parsed.testName || parsed.methodName) {
                this.currentTests.push({
                  methodName: parsed.methodName,
                  outcome: parsed.passed ? 'Pass' : 'Fail',
                })
              }
            } catch {
              // ignore JSON parse errors
            }
          }
        }
      }

      this.watchProcess.stdout?.on('data', handleData)
      this.watchProcess.stderr?.on('data', handleData)

      this.watchProcess.on('error', err => {
        if (!initialized) {
          reject(err)
        } else if (this.currentRunRejecter) {
          const rejectFn = this.currentRunRejecter
          this.currentRunResolver = undefined
          this.currentRunRejecter = undefined
          rejectFn(err)
        }
      })

      this.watchProcess.on('exit', code => {
        this.watchProcess = undefined
        const err = new Error(`AER watch process exited with code ${code}`)
        if (!initialized) {
          reject(err)
        } else if (this.currentRunRejecter) {
          const rejectFn = this.currentRunRejecter
          this.currentRunResolver = undefined
          this.currentRunRejecter = undefined
          rejectFn(err)
        }
      })
    })
  }

  public async runTestMethods(
    testMethods: Set<string> = new Set<string>()
  ): Promise<TestResult> {
    const targetRunCount = this.completedRunsCount + 1
    await new Promise<void>((resolve, reject) => {
      const check = () => {
        if (this.completedRunsCount >= targetRunCount) {
          resolve()
        } else {
          this.currentRunResolver = resolve
          this.currentRunRejecter = reject
        }
      }
      check()
    })

    if (/type error:|parse error:|Skipped \d+ file/i.test(this.currentOutput)) {
      throw new Error(`Deployment failed:\n${this.currentOutput}`)
    }

    let filteredTests = this.currentTests
    if (testMethods.size > 0) {
      filteredTests = this.currentTests.filter(t =>
        testMethods.has(t.methodName)
      )
    }

    const testsRan = filteredTests.length
    const failing = filteredTests.filter(t => t.outcome !== 'Pass').length
    const outcome = failing === 0 && testsRan > 0 ? 'Passed' : 'Failed'

    return {
      summary: {
        outcome,
        testsRan,
        failing,
      },
      tests: filteredTests,
    } as unknown as TestResult
  }

  public destroy(): void {
    if (this.watchProcess) {
      this.watchProcess.kill()
      this.watchProcess = undefined
    }
  }
}
