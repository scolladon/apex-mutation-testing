/**
 * Identity of a single test method, qualified by its declaring class's org
 * Id: `${classId}.methodName`.
 *
 * A bare method name stops being a unique identity once the run spans more
 * than one test class — `setupData` can exist in both FooTest and BarTest.
 * GroupExecutor attributes kill/survive verdicts through a
 * `Map<methodName, outcome>` (src/service/groupExecutor.ts), so an unqualified
 * collision there silently overwrites one class's outcome with the other's.
 * Qualifying the id at the point it enters that map keeps every downstream
 * `Set<string>` a collision-free token, with no change to the grouping or
 * coloring logic that consumes it.
 *
 * The qualifier is the class's `ApexClass.Id`, not its name: an Id is unique
 * on the org by definition and a method name is unique within its class, so
 * `classId.methodName` is unique across the whole run — stronger than
 * `ClassName.methodName`, which was only unique if no two perimeter classes
 * shared a bare name. Two classes sharing a bare name have different Ids, so
 * the merge that used to produce wrong kill attribution cannot occur.
 *
 * Ids are minted exclusively by `qualifyTestMethod`, which always inserts the
 * separator — a dot-less `TestMethodId` is therefore unrepresentable and no
 * defensive check is needed when splitting one back apart.
 *
 * An org Id is 18 characters of `[A-Za-z0-9]` and an Apex method name is
 * `[A-Za-z][A-Za-z0-9_]*`; neither can contain a dot, so a `TestMethodId` has
 * exactly one separator and `split` always yields exactly two segments.
 * Consumers that need the class's display spelling resolve `testClassOf(id)`
 * outward through the run's `TestClassResolutions` map — this type carries
 * no namespace and no display name itself.
 */
export type TestMethodId = string
const SEPARATOR = '.'
const CLASS_SEGMENT = 0
const METHOD_SEGMENT = 1

export const qualifyTestMethod = (
  classId: string,
  methodName: string
): TestMethodId => `${classId}${SEPARATOR}${methodName}`

export const testClassOf = (id: TestMethodId): string =>
  id.split(SEPARATOR)[CLASS_SEGMENT]

export const testMethodOf = (id: TestMethodId): string =>
  id.split(SEPARATOR)[METHOD_SEGMENT]

/**
 * Fold qualified ids back into the per-class shape the Apex test API expects,
 * preserving first-seen class and method order.
 */
export const toTestItems = (
  ids: Iterable<TestMethodId>
): { classId: string; testMethods: string[] }[] => {
  const methodsPerClass = new Map<string, string[]>()
  for (const id of ids) {
    const classId = testClassOf(id)
    const methods = methodsPerClass.get(classId) ?? []
    methods.push(testMethodOf(id))
    methodsPerClass.set(classId, methods)
  }
  return [...methodsPerClass].map(([classId, testMethods]) => ({
    classId,
    testMethods,
  }))
}
