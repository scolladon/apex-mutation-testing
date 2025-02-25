import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import { ApexMutationTestResult } from '../../src/commands/apex/mutation/test/run.js'

//import { join } from 'node:path'

describe('apex mutation test run NUTs', () => {
  let testSession: TestSession

  before(async () => {
    testSession = await TestSession.create({
      /*project: {
        sourceDir: join('test', 'data', 'mutation-repo'),
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          setDefault: true,
          config: join('config', 'project-scratch-def.json'),
          tracksSource: false,
        },
      ],*/
    })
  })

  after(async () => {
    await testSession?.clean()
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

  /* TODO create a dedicated org for this test
     It consumes a lot of scratch orgs
     I need to find a way to use a dedicated org for this test

  it('should run mutation testing successfully', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --class-file MutationClass --test-file MutationClassTest',
      {
        ensureExitCode: 0,
      }
    ).jsonOutput

    expect(result).to.have.property('score', '100')
  })

  it('should handle invalid class file', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --class-file InvalidClass --test-file MutationTest',
      {
        ensureExitCode: 1,
      }
    ).shellOutput

    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(result)

    expect(result).to.include('InvalidClass not found')
  })

  it('should handle invalid test file', async () => {
    const result = execCmd<ApexMutationTestResult>(
      'apex mutation test run --class-file Mutation --test-file InvalidClassTest',
      {
        ensureExitCode: 1,
      }
    ).shellOutput

    expect(result).to.include('InvalidClassTest class not found')
  })
    */
})
