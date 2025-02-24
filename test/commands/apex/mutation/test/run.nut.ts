import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { ApexMutationTestResult } from '../../../../../src/commands/apex/mutation/test/run.js'

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

  it('should run mutation testing successfully', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --class-file TestClass --test-file TestClassTest',
      {
        ensureExitCode: 0,
      }
    ).jsonOutput

    expect(result).to.have.property('sourceFile', 'TestClass')
    expect(result).to.have.property('testFile', 'TestClassTest')
    expect(result).to.have.property('mutants').that.is.an('array')
    expect(result.mutants).to.have.length.greaterThan(0)

    const mutant = result.mutants[0]
    expect(mutant).to.have.property('mutatorName')
    expect(mutant)
      .to.have.property('status')
      .that.is.oneOf(['Killed', 'Survived', 'NoCoverage'])
    expect(mutant).to.have.property('location').that.is.an('object')
    expect(mutant.location).to.have.property('start').that.is.an('object')
    expect(mutant.location).to.have.property('end').that.is.an('object')
    expect(mutant).to.have.property('replacement')
    expect(mutant).to.have.property('original')
  })

  it('should handle invalid class file', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --class-file InvalidClass --test-file TestClassTest',
      {
        ensureExitCode: 1,
      }
    ).shellOutput

    expect(result).to.include('Class not found')
  })

  it('should handle invalid test file', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --class-file TestClass --test-file InvalidTest',
      {
        ensureExitCode: 1,
      }
    ).shellOutput

    expect(result).to.include('Test class not found')
  })
})
