import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AerAdapter, AerCommandBuilder, AerWatchRunner, findClassFile } from '../../../src/adapter/aerAdapter.js'
import { ApexClass } from '../../../src/type/ApexClass.js'

vi.mock('node:fs/promises')
vi.mock('node:child_process')

describe('AerCommandBuilder', () => {
  it('should build command args correctly', () => {
    const args = new AerCommandBuilder()
      .withProjectPath('/my-project')
      .withWatch()
      .withJson()
      .withSkipErrors()
      .withTestClassName('MyTestClass')
      .withAdditionalFlags('--assign-perms PermSet')
      .buildArgs()

    expect(args).toEqual([
      'test',
      '/my-project',
      '--watch',
      '--json',
      '--skip-errors',
      '-f',
      'MyTestClass',
      '--assign-perms',
      'PermSet',
    ])
  })

  it('should build command string with coverage correctly', () => {
    const cmd = new AerCommandBuilder()
      .withProjectPath('/my-project')
      .withSkipErrors()
      .withJson()
      .withCoverage('/tmp/cov.xml', 'cobertura')
      .withTestClassName('MyTestClass')
      .buildCommandString()

    expect(cmd).toBe(
      'aer test /my-project --json --skip-errors --coverage /tmp/cov.xml --coverage-format cobertura -f MyTestClass'
    )
  })
})

describe('AerAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findClassFile', () => {
    it('should recursively find a .cls file matching the class name', async () => {
      // Arrange
      vi.mocked(readdir).mockResolvedValueOnce(['subdir', 'OtherClass.cls'] as never)
      vi.mocked(stat).mockImplementation(async (path: unknown) => {
        if (String(path).endsWith('subdir')) {
          return { isDirectory: () => true } as never
        }
        return { isDirectory: () => false } as never
      })
      vi.mocked(readdir).mockResolvedValueOnce(['MyTargetClass.cls'] as never)

      // Act
      const result = await findClassFile('/project/force-app', 'MyTargetClass')

      // Assert
      expect(result).toBe(join('/project/force-app', 'subdir', 'MyTargetClass.cls'))
    })

    it('should return undefined if class file is not found', async () => {
      // Arrange
      vi.mocked(readdir).mockResolvedValue(['SomeOtherClass.cls'] as never)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as never)

      // Act
      const result = await findClassFile('/project/force-app', 'NonExistentClass')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('readClass', () => {
    it('should read the class file content and populate cache', async () => {
      // Arrange
      const cache = new Map<string, string>()
      vi.mocked(readdir).mockResolvedValue(['MyClass.cls'] as never)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as never)
      vi.mocked(readFile).mockResolvedValue('public class MyClass {}')

      // Act
      const apexClass = await AerAdapter.readClass('/project', 'MyClass', cache)

      // Assert
      expect(apexClass).toEqual({
        Id: 'MyClass',
        Body: 'public class MyClass {}',
        Name: 'MyClass',
      })
      expect(cache.get('MyClass')).toBe(join('/project', 'MyClass.cls'))
    })
  })

  describe('updateClass', () => {
    it('should write updated body to file path from cache', async () => {
      // Arrange
      const cache = new Map<string, string>([
        ['MyClass', join('/project', 'MyClass.cls')],
      ])
      vi.mocked(writeFile).mockResolvedValue(undefined)
      const mutatedClass: ApexClass = {
        Id: 'MyClass',
        Body: 'public class MyClass { /* mutated */ }',
        Name: 'MyClass',
      }

      // Act
      const result = await AerAdapter.updateClass('/project', mutatedClass, cache)

      // Assert
      expect(result).toEqual({ State: 'Completed' })
      expect(writeFile).toHaveBeenCalledWith(
        join('/project', 'MyClass.cls'),
        'public class MyClass { /* mutated */ }',
        'utf-8'
      )
    })
  })
})

describe('AerWatchRunner', () => {
  let mockProcess: {
    stdout: EventEmitter
    stderr: EventEmitter
    on: ReturnType<typeof vi.fn>
    kill: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn(),
      kill: vi.fn(),
    }
    vi.mocked(spawn).mockReturnValue(mockProcess as never)
  })

  it('should start watch process and return test results on subsequent runCompleted event', async () => {
    // Arrange
    const runner = new AerWatchRunner('/project', 'MyTestClass')

    // Initial start
    const startPromise = runner.start()
    mockProcess.stdout.emit('data', Buffer.from('{"watchEvent":"runStarted"}\n'))
    mockProcess.stdout.emit('data', Buffer.from('{"watchEvent":"runCompleted"}\n'))
    await startPromise

    // Act — trigger mutant evaluation run
    const testRunPromise = runner.runTestMethods()
    mockProcess.stdout.emit('data', Buffer.from('{"watchEvent":"runStarted"}\n'))
    mockProcess.stdout.emit('data', Buffer.from('{"methodName":"testOne","passed":true}\n'))
    mockProcess.stdout.emit('data', Buffer.from('{"watchEvent":"runCompleted"}\n'))

    const testResult = await testRunPromise

    // Assert
    expect(testResult.summary.outcome).toBe('Passed')
    expect(testResult.summary.testsRan).toBe(1)
    expect(testResult.tests).toEqual([{ methodName: 'testOne', outcome: 'Pass' }])
  })

  it('should kill watch process on destroy', () => {
    // Arrange
    const runner = new AerWatchRunner('/project', 'MyTestClass')
    runner.start()

    // Act
    runner.destroy()

    // Assert
    expect(mockProcess.kill).toHaveBeenCalled()
  })
})
