import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { describe, it } from 'mocha'
import { ApexMutationTestResult } from '../../src/commands/apex/mutation/test/run.js'

//import { join } from 'node:path'

describe('apex mutation test run NUTs', () => {
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

    expect(jsonResult.result).to.have.property('score', 60)
  })
})
