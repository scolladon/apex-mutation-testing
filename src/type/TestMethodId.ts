/**
 * Identity of a single test method, qualified by its declaring class:
 * `ClassName.methodName`.
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
 * Ids are minted exclusively by `qualifyTestMethod`, which always inserts the
 * separator — a dot-less `TestMethodId` is therefore unrepresentable and no
 * defensive check is needed when splitting one back apart.
 *
 * The split takes the LAST separator so a namespaced qualifier stays intact.
 * That form does not arise today: ApexClassRepository.read pins its lookup to
 * `NamespacePrefix: ''`, so a namespaced class cannot enter the perimeter and
 * cannot be validated. It matters because consumers compare `testClassOf(id)`
 * against the user-typed perimeter entry, which is never namespace-qualified —
 * so were that filter ever relaxed, those comparisons would need to normalise
 * both sides before this type could carry `ns.ClassName.methodName` safely.
 */
export type TestMethodId = string

const SEPARATOR = '.'

export const qualifyTestMethod = (
  className: string,
  methodName: string
): TestMethodId => `${className}${SEPARATOR}${methodName}`

export const testClassOf = (id: TestMethodId): string =>
  id.slice(0, id.lastIndexOf(SEPARATOR))

export const testMethodOf = (id: TestMethodId): string =>
  id.slice(id.lastIndexOf(SEPARATOR) + 1)

/**
 * Fold qualified ids back into the per-class shape the Apex test API expects,
 * preserving first-seen class and method order.
 */
export const toTestItems = (
  ids: Iterable<TestMethodId>
): { className: string; testMethods: string[] }[] => {
  const methodsPerClass = new Map<string, string[]>()
  for (const id of ids) {
    const className = testClassOf(id)
    const methods = methodsPerClass.get(className) ?? []
    methods.push(testMethodOf(id))
    methodsPerClass.set(className, methods)
  }
  return [...methodsPerClass].map(([className, testMethods]) => ({
    className,
    testMethods,
  }))
}
