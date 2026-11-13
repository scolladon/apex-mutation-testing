import type { Messages } from '@salesforce/core'
import { ApexMutationTestResult } from '../type/ApexMutationTestResult.js'
import type { TestClassResolution } from '../type/TestClassResolution.js'
import { testClassOf, testMethodOf } from '../type/TestMethodId.js'
import {
  type MutationTestResult,
  REPORT_SCHEMA_VERSION,
  REPORT_THRESHOLDS,
  type ReportMutant,
  writeMutationReport,
} from './mutationReportPage.js'

export class ApexMutationHTMLReporter {
  constructor(private readonly messages: Messages<string>) {}

  async generateReport(
    apexMutationTestResult: ApexMutationTestResult,
    outputDir: string = 'reports'
  ): Promise<void> {
    // The directory guard, page template and write are shared with every
    // other engine's reporter — see mutationReportPage.ts.
    await writeMutationReport(
      this.transformApexResults(apexMutationTestResult),
      outputDir,
      this.messages
    )
  }

  private transformApexResults(
    apexMutationTestResult: ApexMutationTestResult
  ): MutationTestResult {
    const resolutions = new Map(
      apexMutationTestResult.testClassResolutions.map(r => [r.classId, r])
    )
    const testFiles = buildTestFilesSection(
      apexMutationTestResult.testFiles,
      apexMutationTestResult.mutants,
      resolutions
    )
    const mutationTestResult: MutationTestResult = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      config: {},
      thresholds: REPORT_THRESHOLDS,
      files: {},
      ...(testFiles && { testFiles }),
    }

    mutationTestResult.files[`${apexMutationTestResult.sourceFile}.cls`] = {
      language: 'java',
      source: apexMutationTestResult.sourceFileContent,
      mutants: apexMutationTestResult.mutants.map(mutant =>
        mapMutant(mutant, resolutions)
      ),
    }

    return mutationTestResult
  }
}

// Every identity the report emits is a rendered display name — raw org Ids
// never leave the engine. On a map miss (see the "residual" note in
// mutationTestingService.ts) the raw class Id renders as the qualifier:
// visibly wrong beats plausibly wrong.
const displayOf = (
  id: string,
  resolutions: ReadonlyMap<string, TestClassResolution>
): string =>
  `${resolutions.get(testClassOf(id))?.displayName ?? testClassOf(id)}.${testMethodOf(id)}`

// observed = union of every mutant's attribution.coveredBy. Empty ⇒ no run
// data anywhere in this result (dry run, or every mutant a CompileError) ⇒
// omit testFiles entirely so the app renders no test view.
//
// A class's resolution can carry two lookup keys (its bare and its
// qualified spelling, for an own-namespace class — see spellingsOf), so a
// perimeter naming both ('-t Foo -t acme.Foo') would otherwise place the
// same test id under two groups. The Stryker report schema treats
// `tests[].id` as globally unique — coveredBy/killedBy link mutants to
// tests through it — so each classId is claimed by the first perimeter
// entry it answers to; a later spelling of the same class reports no
// tests of its own.
function buildTestFilesSection(
  perimeter: string[],
  mutants: ApexMutationTestResult['mutants'],
  resolutions: ReadonlyMap<string, TestClassResolution>
): MutationTestResult['testFiles'] {
  const observed = new Set(
    mutants.flatMap(mutant => mutant.attribution?.coveredBy ?? [])
  )
  if (observed.size === 0) return undefined

  const idsByClassId = new Map<string, string[]>()
  for (const id of observed) {
    const classId = testClassOf(id)
    idsByClassId.set(classId, [...(idsByClassId.get(classId) ?? []), id])
  }

  const claimedClassIds = new Set<string>()
  return Object.fromEntries(
    perimeter.map(className => {
      const key = className.toLowerCase()
      const claims = [...idsByClassId].filter(
        ([classId]) =>
          !claimedClassIds.has(classId) &&
          // Stryker disable next-line ArrayDeclaration: this is only ever
          // .includes()-checked against `key`, already toLowerCase()'d
          // above; the injected uppercase literal can never match.
          (resolutions.get(classId)?.lookupKeys ?? []).includes(key)
      )
      for (const [classId] of claims) claimedClassIds.add(classId)
      const tests = claims
        .flatMap(([, ids]) => ids)
        .map(id => displayOf(id, resolutions))
        .sort()
        .map(display => ({ id: display, name: display }))
      return [className, { tests }]
    })
  )
}

function mapMutant(
  mutant: ApexMutationTestResult['mutants'][number],
  resolutions: ReadonlyMap<string, TestClassResolution>
): ReportMutant {
  // Re-sorted after resolution, not before: the engine sorts these by
  // TestMethodId, which is class-id-qualified, so the order it produces is
  // stable but keyed on something no reader of the report can see. Sorting the
  // rendered display names is what makes the report deterministic in the
  // reader's own terms — and is what the e2e snapshot asserts byte-for-byte.
  const attribution = mutant.attribution
    ? {
        coveredBy: mutant.attribution.coveredBy
          .map(id => displayOf(id, resolutions))
          .sort(),
        killedBy: mutant.attribution.killedBy
          .map(id => displayOf(id, resolutions))
          .sort(),
        testsCompleted: mutant.attribution.testsCompleted,
      }
    : undefined
  return {
    id: mutant.id,
    mutatorName: mutant.mutatorName,
    replacement: mutant.replacement,
    status: mutant.status,
    statusReason: mutant.statusReason,
    static: false,
    coveredBy: attribution?.coveredBy,
    killedBy: attribution?.killedBy.length ? attribution.killedBy : undefined,
    testsCompleted: attribution?.testsCompleted ?? 0,
    location: {
      start: {
        line: mutant.location.start.line,
        column: mutant.location.start.column,
      },
      end: {
        line: mutant.location.end.line,
        column: mutant.location.end.column,
      },
    },
  }
}
