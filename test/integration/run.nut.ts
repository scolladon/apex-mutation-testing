import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { describe, it } from 'mocha'
import { ApexMutationTestResult } from '../../src/commands/apex/mutation/test/run.js'

describe('apex mutation test run NUTs', () => {
  it('should create report directory and index.html by default', async () => {
    const reportDir = 'mutations'

    // Ensure the directory doesn't exist before the test
    await fs.rm(reportDir, { recursive: true, force: true })

    // Run the mutation test command
    execCmd<ApexMutationTestResult>(
      `apex mutation test run -o bulk-wizard --apex-class Mutation --test-class MutationTest --json`,
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Check directory exists
    const dirExists = await fs
      .access(reportDir)
      .then(() => true)
      .catch(() => false)
    expect(dirExists, `Report directory ${reportDir} should exist`).to.be.true

    // Check index.html exists in the directory
    const indexPath = path.join(reportDir, 'index.html')
    const indexExists = await fs
      .access(indexPath)
      .then(() => true)
      .catch(() => false)
    expect(indexExists, `Index.html should exist at ${indexPath}`).to.be.true

    // Read the contents of the index.html
    const indexContent = await fs.readFile(indexPath, 'utf-8')
    expect(indexContent).to.include('mutation-test-report-app')
  })

  it('should display help', () => {
    // Act
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --help',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Assert
    expect(result).to.include('mutation')
  })

  it('should create report directory with passed in argument', async () => {
    const reportDir = 'reports/nut-directory-test'

    // Ensure the directory doesn't exist before the test
    await fs.rm(reportDir, { recursive: true, force: true })

    // Run the mutation test command
    execCmd<ApexMutationTestResult>(
      `apex mutation test run -o bulk-wizard --report-dir ${reportDir} --apex-class Mutation --test-class MutationTest --json`,
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Check directory exists
    const dirExists = await fs
      .access(reportDir)
      .then(() => true)
      .catch(() => false)
    expect(dirExists, `Report directory ${reportDir} should exist`).to.be.true

    // Check index.html exists in the directory
    const indexPath = path.join(reportDir, 'index.html')
    const indexExists = await fs
      .access(indexPath)
      .then(() => true)
      .catch(() => false)
    expect(indexExists, `Index.html should exist at ${indexPath}`).to.be.true

    // Optional: Read the contents of the index.html
    const indexContent = await fs.readFile(indexPath, 'utf-8')
    expect(indexContent).to.include('mutation-test-report-app')
  })

  it('should display help', () => {
    // Act
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --help',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Assert
    expect(result).to.include('mutation')
  })

  it('should handle invalid class file', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run -o apex-mutation-testing --report-dir reports/nut --apex-class InvalidClass --test-class MutationTest',
      {
        ensureExitCode: 1,
      }
    ).shellOutput

    expect(result.stderr).to.include('InvalidClass not found')
  })

  it('should handle invalid test file', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run -o apex-mutation-testing --report-dir reports/nut --apex-class Mutation --test-class InvalidClassTest',
      {
        ensureExitCode: 1,
      }
    ).shellOutput

    expect(result.stderr).to.include('InvalidClassTest not found')
  })

  it('should run mutation testing successfully', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run -o apex-mutation-testing --report-dir reports/nut --apex-class Mutation --test-class MutationTest --json',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    const jsonResult = JSON.parse(result.stdout)

    expect(jsonResult.result).to.have.property('score', 100)
  })
})
