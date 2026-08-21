import { Messages } from '@salesforce/core'
import { formatSkippedTestClass } from '../../../src/service/skippedTestClassMessage.js'
import { SkippedTestClass } from '../../../src/type/SkippedTestClass.js'

// This is the only suite in the repo that does not mock @salesforce/core.
// Every other suite hands formatSkippedTestClass a hand-written template
// map, so a heading or key rename in messages/apex.mutation.test.run.md can
// ship green and only throw MissingMessageError at runtime, on the failure
// path a happy-path e2e run never exercises. Loading the real bundle here
// mirrors run.ts:18-22 exactly, so a missing or misnamed key fails this
// suite the same way it would fail the shipped command.
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(
  'apex-mutation-testing',
  'apex.mutation.test.run'
)

describe('apex.mutation.test.run message bundle', () => {
  it('Given a not-found skip with no provenance, When formatted against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'MyClasTest',
      reason: 'not-found',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'MyClasTest': it could not be found on this org."
    )
  })

  it('Given a not-accessible skip, When formatted against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'et4ae5Test',
      reason: 'not-accessible',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'et4ae5Test': it is not accessible on this org."
    )
  })

  it('Given a does-not-compile skip carrying a detail, When formatted against the real bundle, Then the detail renders as a parenthetical after the reason', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'AmtProbeDepTest',
      reason: 'does-not-compile',
      detail: 'Invalid type: AmtProbeDep at line 3 column 5',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'AmtProbeDepTest': it does not compile (Invalid type: AmtProbeDep at line 3 column 5)."
    )
  })

  it('Given a no-coverage skip, When formatted against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BarTest',
      reason: 'no-coverage',
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BarTest': it contributed no covered lines."
    )
  })

  it('Given a no-coverage skip contributed by two suites, When formatted against the real bundle, Then the render site applies the separator space the loader trims from the fragment', () => {
    // Arrange
    const skipped: SkippedTestClass = {
      className: 'BarTest',
      reason: 'no-coverage',
      suiteNames: ['SmokeSuite', 'RegressionSuite'],
    }

    // Act
    const sut = formatSkippedTestClass(skipped, messages)

    // Assert
    expect(sut).toBe(
      "Skipping test class 'BarTest' (contributed by test suite 'SmokeSuite', 'RegressionSuite'): it contributed no covered lines."
    )
  })

  it('Given the class name and one skip sentence, When error.noUsableTestClass is rendered against the real bundle, Then the class name and the drop list appear on separate lines', () => {
    // Arrange
    const dropped =
      "Skipping test class 'MyClasTest': it could not be found on this org."

    // Act
    const sut = messages.getMessage('error.noUsableTestClass', [
      'MyClass',
      dropped,
    ])

    // Assert
    expect(sut).toBe(
      "No usable Apex test class remains in the perimeter for 'MyClass'. The following test class(es) were skipped:\nSkipping test class 'MyClasTest': it could not be found on this org."
    )
  })

  it('Given a fallback reason, When info.syncTransportFallback is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const reason = 'View Setup permission required'

    // Act
    const sut = messages.getMessage('info.syncTransportFallback', [reason])

    // Assert
    expect(sut).toBe(
      'Synchronous test execution is unavailable (View Setup permission required). Falling back to the asynchronous transport.'
    )
  })

  it('Given unresolved type names and a reason, When info.typeResolutionDegraded is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const names = 'Foo, Bar'
    const reason = ' (EntityDefinition not accessible)'

    // Act
    const sut = messages.getMessage('info.typeResolutionDegraded', [
      names,
      reason,
    ])

    // Assert
    expect(sut).toBe(
      'Type resolution degraded for Foo, Bar: these types could not be resolved against the org, so type-aware mutators fall back to untyped behaviour and some mutants are not generated (EntityDefinition not accessible).'
    )
  })

  it('Given a class name, When error.apexClassNotFound is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const className = 'MyClass'

    // Act
    const sut = messages.getMessage('error.apexClassNotFound', [className])

    // Assert
    expect(sut).toBe("Apex class 'MyClass' not found.")
  })

  it('Given a class name and a joined state list, When error.apexClassNotMutable is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const className = 'MyClass'
    const states = 'installed'

    // Act
    const sut = messages.getMessage('error.apexClassNotMutable', [
      className,
      states,
    ])

    // Assert
    expect(sut).toBe(
      "Apex class 'MyClass' cannot be modified on this org (manageable state: installed). Only classes this org owns — unmanaged, unlocked-package or packaging-org source — can be mutated."
    )
  })

  it('Given a class name and a joined spelling list, When error.apexClassAmbiguous is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const className = 'Argument'
    const spellings = 'mockery.Argument, acme.Argument'

    // Act
    const sut = messages.getMessage('error.apexClassAmbiguous', [
      className,
      spellings,
    ])

    // Assert
    expect(sut).toBe(
      "Apex class 'Argument' matches more than one modifiable Apex class on this org: mockery.Argument, acme.Argument. Re-run naming one of them."
    )
  })

  it('Given a malformed class name, When error.invalidClassName is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const className = 'ns.sub.Foo'

    // Act
    const sut = messages.getMessage('error.invalidClassName', [className])

    // Assert
    expect(sut).toBe(
      "Invalid Apex class name: 'ns.sub.Foo'. An Apex class name starts with a letter and contains only letters, digits and underscores, optionally prefixed by a namespace and a dot (for example 'MyClass' or 'MyNamespace.MyClass')."
    )
  })

  it('Given a class name using the object convention, When error.objectConventionClassName is rendered against the real bundle, Then the exact shipped sentence is produced', () => {
    // Arrange
    const className = 'namespaced__Mutation'

    // Act
    const sut = messages.getMessage('error.objectConventionClassName', [
      className,
    ])

    // Assert
    expect(sut).toBe(
      "Apex class name 'namespaced__Mutation' uses the object convention 'Namespace__Name'. Apex classes use the dotted convention instead: write 'Namespace.Name'."
    )
  })
})
