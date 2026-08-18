# Design Document

## Overview

Salesforce CLI plugin implementing **mutation testing** for Apex code. It evaluates test suite quality by introducing intentional code mutations into a deployed Apex class, running the associated tests against each mutation, and reporting which mutants were **killed** (detected) versus **survived** (undetected).

```shell
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg>
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --dry-run
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --include-mutators ArithmeticOperator --threshold 80
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --skip-patterns "System\\.debug" --lines 10-50 100-120
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --config-file .mutation-testing.json
sf apex mutation test run -c <ApexClass> --test-suite <TestSuite> -o <TargetOrg>
```

**Runtime:** requires Node 22, 24, or 26 (`engines.node` = `^22.22 || ^24.15 || >=26`).

---

## Architecture Layers

```text
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│              commands/apex/mutation/test/run.ts           │
│           (CLI flags, progress UI, score output,         │
│            config resolution, threshold gating;          │
│            builds the EngineBundle via createOrgEngine    │
│            before constructing the service)               │
├──────────────────────────────────────────────────────────┤
│                  Configuration Layer                      │
│              service/configReader.ts                      │
│     (JSON config file + CLI flag merging)                │
├──────────────────────────────────────────────────────────┤
│                   Orchestration Layer                     │
│            service/mutationTestingService.ts              │
│     (workflow coordination via named sub-methods,        │
│      error classification, score calculation,            │
│      result assembly — depends only on the three         │
│      src/port/ interfaces, via EngineBundle)              │
├──────────────────────────────────────────────────────────┤
│                      Domain Layer                         │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │  Mutation Engine     │  │     Type System            │ │
│  │  mutantGenerator.ts  │  │  typeDiscoverer.ts         │ │
│  │  mutationListener.ts │  │  typeMatcher.ts            │ │
│  │  baseListener.ts     │  │  TypeRegistry.ts           │ │
│  │  astUtils.ts         │  │  ApexMethod.ts             │ │
│  │  [26 mutators]       │  │                            │ │
│  └─────────────────────┘  └────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                       Port Layer                           │
│   src/port/ — interfaces only; zero outbound imports       │
│   beyond sibling ports and Connection's type (ADR 084)     │
│                                                            │
│   executionEngine.ts      EngineContext · EngineBundle ·    │
│                           EngineNotice                      │
│   apexSourceProvider.ts   ApexSourceProvider ·              │
│                           TypeDependencies                 │
│   sObjectSchemaProvider.ts  SObjectSchemaProvider           │
│   mutationTestBed.ts      MutationTestBed · MutantVerdict · │
│                           Baseline · RestorePolicy          │
├──────────────────────────────────────────────────────────┤
│           Infrastructure Layer — src/adapter/org/          │
│   orgEngine.ts (createOrgEngine) builds the port          │
│   implementations below and hands them to the caller as   │
│   one EngineBundle:                                        │
│                                                            │
│     OrgApexSourceProvider    implements ApexSourceProvider │
│     OrgMutationTestBed       implements MutationTestBed    │
│     OrgSObjectSchemaProvider implements SObjectSchemaProvider│
│                                                            │
│   The first two wrap four internal repositories — nothing │
│   outside this directory imports them directly:           │
│  ┌───────────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │ApexClassRepository│ │ApexTestRunner│ │ApexSettings   │ │
│  │  (Tooling API)    │ │ (apex-node) │ │Repository     │ │
│  │                   │ │             │ │(Tooling API)  │ │
│  └───────────────────┘ └─────────────┘ └──────────────┘ │
│  ┌──────────────────────┐                                │
│  │ApexTestSuiteRepository│                                │
│  │  (Tooling API)        │                                │
│  └──────────────────────┘                                │
├──────────────────────────────────────────────────────────┤
│                    Reporting Layer                        │
│  ┌───────────────────────────────────────────────────────┐│
│  │  HTMLReporter.ts                                      ││
│  │ (Stryker schema, mutation-test-elements,              ││
│  │  used for both normal and dry-run paths)              ││
│  └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

`OrgSObjectSchemaProvider` has no separate internal repository behind it — it is the
renamed `SObjectDescribeRepository`, implementing `SObjectSchemaProvider` directly against
`Connection.describe` (see [Repository Pattern — Adapter Layer](#repository-pattern--adapter-layer)).

---

## Mutation Testing Lifecycle

```text
sf apex mutation test run -c MyClass -t MyClassTest -o myOrg
│
├─ 1. RESOLVE CONFIGURATION
│     ConfigReader.resolve(cliFlags)
│       ├─ validate: -c names an Apex identifier
│       ├─ read .mutation-testing.json (if exists)
│       ├─ merge: CLI flags override config file
│       ├─ validate: threshold 0-100
│       └─ validate: lines format (N or N-M, start ≤ end)
│     Precedence: CLI flags > config file > defaults
│
├─ 2. RESOLVE TEST SUITES
│     TestSuiteResolver.resolve(parameter)
│       → no-op when --test-suite is not provided
│     ApexTestSuiteRepository.readMembers(suiteNames)
│       → one Tooling API join on TestSuiteMembership,
│         ordered by ApexClass.Name
│       ├─ a suite name absent from the results is
│       │    unresolved: readExistingSuiteNames() tells
│       │    an empty suite from an unknown one, then
│       │    throws — before any deploy or test run
│       └─ otherwise: union every resolved member class
│            name with the -t classes via
│            ConfigReader.normalizeClassPerimeter (trim,
│            dedupe case-insensitively, reject blanks,
│            reject non-identifier names) —
│            CLI classes first, then the suites in flag
│            order, each suite's members by class name
│
├─ 3. VALIDATE + REDUCE THE PERIMETER
│     ApexClassValidator.validate(MyClass)
│       → exists? (fatal: error.apexClassNotFound)
│     ApexClassValidator.assessPerimeter(-t perimeter)
│       → ONE batched Tooling query, Name IN (…), projecting only
│         Name + NamespacePrefix — no perimeter class body is ever
│         fetched
│       ├─ name absent from the query result    → "not found"      · drop
│       └─ every row for the name is namespaced → "not accessible" · drop
│     Each drop renders as a warning naming the class, the reason, and
│       the contributing test suite when the class arrived via
│       --test-suite
│     GUARD: perimeter empty after this reduction?
│       → error.noUsableTestClass, before any org write, restating
│         every dropped class and its reason
│
├─ 4. FETCH SOURCE
│     engine.source.readClass(MyClass) → { Id, Body }
│       (OrgApexSourceProvider → ApexClassRepository.read)
│
├─ 5. DISCOVER DEPENDENCIES
│     engine.source.listDependencies(apexClass)
│       (OrgApexSourceProvider → ApexClassRepository.getApexClassDependencies)
│       → TypeDependencies { apexClasses, sObjects }
│       → sObjects already merges StandardEntity ∪ CustomObject
│
├─ 6. BUILD TYPE SYSTEM
│     engine.schema.describe(sObjectTypes)
│       (OrgSObjectSchemaProvider.describe — no repository behind it;
│        it is the renamed SObjectDescribeRepository)
│       → parallel Describe API calls (max 25 concurrent)
│     TypeDiscoverer.analyzeFull(Body)
│       → single ANTLR parse, returns
│         { typeRegistry, tree, tokenStream }
│         (methodTypeTable keyed by name+arity AND name-only,
│          variableScopes, classFields)
│       → tree + tokenStream are threaded into step 9 so
│         MutantGenerator skips its own parse (see Perf-3).
│
├─ 7-8. VERIFY COMPILATION + BASELINE TEST RUN (fused behind one port call)
│     engine.testBed.prepare(apexClass, perimeter, hooks)
│       (OrgMutationTestBed.prepare — src/adapter/org/orgMutationTestBed.ts)
│     The bed never touches UI (ADR 086): it fires hooks.onVerifying() /
│       onVerified() / onBaselineStarting() in order, and
│       MutationTestingService.prepareBaseline() renders the exact spinner
│       text the two formerly-separate service methods used to render —
│       one fewer bed responsibility, same on-screen behaviour.
│
│     7. Compilability verification (target class only)
│       Deploy main class back to org via
│         ApexClassRepository.update(apexClass)
│         → wrapped in timeExecution() → applyMs
│         → validates class compiles (catches broken deps)
│         → on failure: throw CompilationCheckFailedError, which
│           prepareBaseline() re-renders as error.compilabilityCheckFailed
│           with the Salesforce error details
│       Rationale: Salesforce only checks compilation of
│         the deployed element, not its dependents. A class
│         can be broken if a dependency changed after last
│         deploy. Without this check, all mutants would get
│         CompileError → misleading 100% score.
│       The test-class perimeter is NOT deployed here to prove it
│         compiles — that pre-flight is deleted. Compilation of the
│         perimeter is a documented prerequisite; a class that fails
│         to compile is instead reported by the baseline test run
│         below and dropped with a warning, rather than aborting the
│         whole command
│
│     8. Baseline test run
│       selects the coverage strategy up front, inside the bed —
│         ApexSettingsRepository.isAggregateCoverageOnly()
│         (Tooling API: ApexSettings.IsAggregateCodeCoverageOnlyEnabled)
│         → knowledge, not inference: picks PerTestCoverageStrategy
│           or AggregateCoverageStrategy (see Strategy
│           Pattern — Coverage Fidelity)
│       ApexTestRunner.getTestMethodsPerLines(perimeter[], coverageStrategy)
│         → wrapped in timeExecution() → runMs
│         → obeys the same transport predicate as every other run in
│           this lifecycle (see Transport Selection): a single-class
│           perimeter runs synchronously, at zero DailyAsyncApexTests
│           cost; two or more classes run asynchronously. Either way
│           apex-node's tests: TestItem[] takes every class natively,
│           so an N-class perimeter costs no extra deploy or run cycle
│         → a @TestSetup row is excluded before any classification
│           runs — cross-referenced against the async transport's own
│           `TestResult.setup` array (the synchronous transport never
│           reports a setup row at all) rather than trusted by its
│           absence from `tests` — so it never becomes a TestMethodId,
│           never contributes coverage, and is never re-run per mutant
│         → partitions the returned rows: a CompileFail row names its
│           class and the platform's own message and is excluded from
│           coverage extraction — before the coverage strategy above
│           ever sees the row — while any other non-Pass row aborts
│           the run exactly as before ("Original tests failed! Cannot
│           proceed with mutation testing.")
│         → testMethodsPerLine: Map<line, Set<TestMethodId>>
│           (TestMethodId = "ClassName.methodName", minted here via
│            qualifyTestMethod so identically-named methods in
│            different perimeter classes never collide; shaped by
│            the selected coverageStrategy; union across the
│            perimeter under PerTestCoverageStrategy; CompileFail rows
│            never reach it)
│         ✓ Every executed test must pass (green baseline) — a class
│           that never executed a test contributes nothing to that
│           evidence
│       prepare() returns a Baseline: { outcome, testsRan,
│         compileFailures, otherFailureCount, testMethodsPerLine,
│         fidelity, cost: { applyMs, runMs } }
│
│     Back in the service, MutationTestingService.runBaselineTests()
│       reduces the perimeter from that Baseline:
│     A class reported CompileFail is named in a warning ("it does
│       not compile", with the platform's diagnosis) and dropped
│       from the perimeter; the run proceeds on the remainder
│     GUARD: perimeter empty after the compile drops?
│       → error.noUsableTestClass, before coverage is extracted,
│         restating every compile-failed class
│     Any remaining perimeter class contributing zero covered lines
│       is named in a non-fatal warning and dropped — per-test
│       fidelity only, since AggregateCoverageStrategy has no
│       per-test attribution to compute it from
│
├─ 8b. FILTER TEST METHODS (if configured)
│     buildTestMethodFilter() → predicate (or undefined)
│     filterTestMethods(testMethodsPerLine, predicate)
│       → filter testMethodsPerLine in-place
│       → a filter entry matches a bare methodName (applies to
│         that method in every perimeter class) or a qualified
│         ClassName.methodName (applies to exactly one class)
│       → lines with zero remaining methods are deleted
│       → coveredLines derived after filtering
│     Rationale: filtering early reduces both the number
│       of mutations generated AND test executions per mutant.
│
├─ 9. GENERATE MUTATIONS
│     MutantGenerator.compute(Body, coveredLines, typeRegistry,
│       mutatorFilter, skipPatterns, allowedLines, preParsed?)
│       → when preParsed is supplied (from step 6), the lexer
│         and parser are SKIPPED — tree + tokenStream are reused
│       → otherwise a fresh parse happens (legacy call sites)
│       → filter mutator registry by include/exclude
│         (case-insensitive name matching)
│       → ParseTreeWalker fires enter*/exit* on filtered mutators
│         (filtered by isLineEligible() via Proxy —
│          intersects coverage, line ranges, skip patterns)
│       → returns { mutations: ApexMutation[], tokenStream }
│         so step 11 can reuse the stream across mutate() calls.
│
├─ 10. TIME ESTIMATION
│     estimate = (deployTime + testTime) × mutantCount
│     Display: "Estimated time: ~Xm Ys"
│     Breakdown: "Deploy: ~Xs/mutant | Test: ~Xs/mutant"
│
│     ── DRY-RUN EXIT POINT ──────────────────────────
│     If --dry-run: return ApexMutationTestResult
│       with all mutants in Pending status and stop.
│       No deployment, no test execution, no rollback.
│       Compilability + estimate ARE displayed.
│       Command generates HTML report (same as normal
│       path) and returns { score: null }.
│     ────────────────────────────────────────────────
│
├─ 11. MUTATION TESTING LOOP (for each mutation)
│     ┌─────────────────────────────────────────────┐
│     │ a. MutantGenerator.mutate(mutation, tokens)  │
│     │    → TokenStreamRewriter → mutated source    │
│     │    (tokens passed from step 9, never cached  │
│     │     on the generator instance)               │
│     │                                              │
│     │ b-c. engine.testBed.evaluate(mutated, tests)  │
│     │      (OrgMutationTestBed.evaluate)             │
│     │    → deploy: try { MetadataContainer create +  │
│     │           poll (exponential backoff, 5-min     │
│     │           timeout → PollTimeoutError on exceed)│
│     │      } finally { fire-and-forget               │
│     │        deleteContainer(id) — non-blocking so N │
│     │        mutants don't pay N extra round-trips }  │
│     │    → a deploy failure is CAUGHT inside evaluate │
│     │      and returned as a MutantVerdict rather     │
│     │      than thrown: { kind: 'not-compilable',     │
│     │      detail } — data crossing the port, not an  │
│     │      exception (ADR 087)                        │
│     │    → on successful deploy: ApexTestRunner.      │
│     │      runTestMethods(testMethodIds), only tests  │
│     │      covering the mutated line, folded back per │
│     │      class (toTestItems); outcomes matched by   │
│     │      qualified id, so a same-named method in    │
│     │      two perimeter classes is never conflated;  │
│     │      returned as { kind: 'executed', result }   │
│     │                                                │
│     │ d. GroupExecutor.evaluateGroup classifies the  │
│     │    MutantVerdict (or the caught 'threw' outcome│
│     │    for an infrastructure failure — see          │
│     │    Structured Error Classification):            │
│     │    Tests failed        → Killed                │
│     │    Tests passed        → Survived               │
│     │    kind: not-compilable → CompileError          │
│     │    Limit error          → Killed (ordinary      │
│     │                            failing test row)    │
│     │    Other thrown error   → RuntimeError          │
│     │                                                │
│     │ e. Update progress bar with remaining time     │
│     │    rolling avg = elapsed / completed           │
│     │    remaining = avg × (total - completed)       │
│     │    "Remaining: ~Xm Ys | <result>"               │
│     └─────────────────────────────────────────────┘
│
├─ 12. ROLLBACK
│      engine.testBed.restore(policy)
│      (OrgMutationTestBed.restore → ApexClassRepository.update(original,
│       policy) — RUN_TESTS on the success path, SKIP_TESTS on the
│       failure path; both live in src/port/mutationTestBed.ts)
│      On failure: spinner shows "Rollback FAILED …"
│      and the error is RE-THROWN so CI / scripts observe
│      a non-zero exit when a class is left mutated.
│
├─ 13. REPORT
│      HTMLReporter →
│        ├─ path.resolve(outputDir) + realpath(outputDir)
│        │  both must live inside process.cwd(). The directory
│        │  itself is pre-validated by the CLI flag
│        │  (`Flags.directory({ exists: true })`); the reporter
│        │  never creates it.
│        ├─ inline mutation-testing-elements bundle
│        │  (vendored from node_modules, not a CDN dep)
│        └─ emit Stryker JSON inside a
│           <script type="application/json"> data island,
│           with </, <!--, -->, <script, U+2028/2029 escaped
│
├─ 14. SCORE
│      score = killed / (total - compileErrors) × 100
│
└─ 15. THRESHOLD GATING (if configured)
│      If score < threshold → throw SfError (exit code 1)
│      Message: "Mutation score X% is below threshold Y%"
│      Skipped in dry-run mode (no score computed)
```

### `process()` Method Decomposition

The `process()` method is a thin orchestrator that delegates each lifecycle step to a named
private method. `MutationTestingService` no longer builds its own org collaborators — it
receives a ready-made `EngineBundle` (`{ source, schema, testBed }`) through its constructor,
built once by `createOrgEngine` in `run.ts` — so `createAdapters()` is gone entirely:

```text
process()
├── fetchApexClass()                  → step 4, via engine.source.readClass
├── discoverTypes()                   → steps 5-6, via engine.source.listDependencies
│                                        + engine.schema
├── runBaselineTests()                → steps 7+8 (compile verify + baseline, fused)
│   ├── prepareBaseline()                 → engine.testBed.prepare(original, perimeter,
│   │                                        hooks) — hooks render the spinner; the bed
│   │                                        itself never touches UI (ADR 086)
│   ├── assertUsableBaseline()            → guards: failing tests / zero tests ran
│   └── reducePerimeterFromBaseline()     → drops compile-failed / zero-coverage classes
├── extractCoveredLines()             → step 8b guard
├── generateMutations()               → step 9
├── planGroups()                      → mutation-grouping plan (DSATUR + exact coloring)
├── displayTimeEstimate()             → step 10
├── buildDryRunResult()               → dry-run exit point
└── executeMutationLoopWithRollback() → steps 11-12
    ├── executeMutationLoop()             → step 11, delegates each group to
    │   └── GroupExecutor.evaluate()          GroupExecutor, which calls
    │       └── evaluateGroup()               engine.testBed.evaluate() and classifies
    │                                          the returned MutantVerdict
    ├── rollback()                    → step 12 (loop resolves): testBed.restore(RUN_TESTS)
    ├── stopProgress()                → tears down the progress bar before a failure-path
    │                                    rollback
    └── rollbackAfterLoopFailure()    → step 12 (loop rejects): testBed.restore(SKIP_TESTS),
                                          composes the combined error
```

`verifyCompilation()` and `selectCoverageStrategy()` are gone as separate service methods:
both are folded into the single `engine.testBed.prepare(original, perimeter, hooks)` call —
the org bed verifies compilation, picks the coverage strategy, and runs the baseline test in
one port call, firing `hooks.onVerifying` / `onVerified` / `onBaselineStarting` so
`prepareBaseline()` can render the exact spinner text the two separate methods used to render,
without the bed knowing what a spinner is. `evaluateMutation()` no longer exists under that
name either: its former responsibility — deploy one mutation, run its tests, classify the
outcome — is `GroupExecutor.evaluateGroup` (`src/service/groupExecutor.ts`; see
[Mutation Grouping](#mutation-grouping-opt-in)), which classifies the `MutantVerdict`
`engine.testBed.evaluate()` returns instead of catching a thrown compile error. `rollback()`
now calls `engine.testBed.restore(policy)` instead of a bare repository update.

Each method encapsulates one logical concern. `formatRemainingTime()` extracts the time
estimation math from the progress update. `rollback()` throws on failure instead of
swallowing so that `process()`'s caller observes a non-zero exit whenever the target org is
left in a mutated state.

The restore now runs on every exit of `executeMutationLoop()`, not only when it resolves:
`executeMutationLoopWithRollback()` wraps the loop call in a `catch` that restores and
rethrows — deliberately not a `finally`, since a rejecting `finally` replaces the pending
rejection and would destroy the original failure. When the loop fails and the restore also
fails, the loop failure leads the thrown message and the restore failure is appended to it,
with the loop error kept as the `cause`. This is the same discipline the test bed's own
disposal contract follows — see
[Execution Ports](#execution-ports).

---

## Core Design Patterns

### Execution Ports

The plugin talks to Salesforce through exactly three ports (`src/port/`), each an interface
with zero outbound imports beyond sibling ports and `Connection`'s type (ADR 084):

- `ApexSourceProvider` (`apexSourceProvider.ts`) — class existence/read, dependency
  discovery, perimeter assessment, and test-suite resolution.
- `SObjectSchemaProvider` (`sObjectSchemaProvider.ts`) — SObject field type resolution for
  the type system.
- `MutationTestBed` (`mutationTestBed.ts`) — `prepare` (compile verification and the
  baseline test run, fused behind one call), `evaluate` (deploy one mutant, run its covering
  tests, and return a `MutantVerdict` rather than throw on a compile failure — ADR 087), and
  `restore`.

`executionEngine.ts` holds the wiring types shared by any implementation of the three ports —
`EngineContext` (the `Connection`, the target class name, and a `notify` callback for
cross-cutting notices) and `EngineBundle` (`{ source, schema, testBed }`) — but declares no
implementation itself.

`src/adapter/org/orgEngine.ts` exposes `createOrgEngine(ctx)`, which builds the three
implementations over one shared `ApexClassRepository` and returns them as a single
`EngineBundle`. `run.ts` calls it once, before constructing `MutationTestingService`, so the
service only ever sees the three ports through `EngineBundle` — it holds no adapter import of
its own.

**Why there is no engine factory.** An earlier draft of this refactor added an `EngineId`
union and a `Record<EngineId, …>` dispatch table, anticipating a second engine that would run
Apex locally instead of against an org. That engine turned out to be unnecessary: `aer server`
presents a Salesforce-compatible API, so a local runtime is reached as an ordinary org alias
and every adapter here works against it unchanged. Dispatch over a set of one is not dispatch,
so the factory, the `EngineId` union and the `AsyncDisposable` teardown contract were all
removed before this work merged (ADRs 085, 089 and 091, superseded).

The ports themselves stay, because their value was never engine-swapping — it is that
`MutationTestingService` no longer imports `@salesforce/core` or `jsforce`, and can be tested
against fakes instead of a mocked SDK.

### Mutation Grouping (opt-in)

When `--mutation-grouping` (or `mutationGrouping: true` in config) is enabled, mutations whose covering tests are pairwise disjoint are deployed and tested as a batch — turning N deploys + N test-runs into G deploys + G test-runs (where G = chromatic number of the conflict graph).

The feature is split across three small modules:

```text
  src/service/mutationGrouper.ts     (groupMutations function)
  src/service/groupExecutor.ts       (GroupExecutor class)
  src/service/mutationLocation.ts    (calculateMutationPosition, extractMutationOriginalText)
```

**Planning.** `MutationTestingService.planGroups` calls `groupMutations(mutations, testMethodsPerLine)` — DSATUR (Brélaz 1979), the strongest polynomial-time graph-coloring heuristic, applied to the conflict graph (edge ⇔ two mutations share at least one covering test).
The conflict graph is the intersection graph of per-mutation test sets, so the largest test-induced clique is a free lower bound on the chromatic number; `groupMutations` returns this `lowerBound` alongside the partition and pre-colors the witness clique to seed DSATUR with a maximally-constrained start.
The grouping telemetry line surfaces the lower bound, so users see when `groups.length === lowerBound` certifies the partition as provably optimal.
When grouping is disabled, `planGroups` builds singleton groups inline, skipping the conflict graph entirely.

**Execution.** `MutationTestingService.executeMutationLoop` constructs one `GroupExecutor` per session (with all session-scoped collaborators: apex class, token stream, coverage map, repo, test runner, generator, progress, messages) and iterates `executor.evaluate(group, completedSoFar, loopStartTime, totalMutations)` for each group. The executor owns all per-iteration concerns:

- `MutantGenerator.mutateMany` applies all replacements on a single `TokenStreamRewriter`.
- `ApexTestRunner.runTestMethods` runs the union of covering test methods, through the same synchronous/asynchronous transport predicate as the baseline (see Transport Selection).
- For `k = 1`, status comes from `testResult.outcome` (legacy semantics).
- For `k > 1`, per-method outcomes from `testResult.tests[]` are reverse-mapped to mutations via `testMethodsPerLine`: a mutation is `Killed` iff at least one of its covering test methods has outcome ≠ `Pass`. The grouping invariant (no test covers two mutations in the same group) makes this attribution unambiguous.
- On a deploy or runtime error: for `k = 1`, classify the error directly (`CompileError` / `RuntimeError`); for `k > 1`, fall back by recursing — each mutation becomes its own `k = 1` singleton group, and the leaf path classifies any error. A governor-limit exception never reaches this classification: the org reports it as an ordinary failing test row rather than throwing, so it is scored `Killed` through the normal per-method attribution above.

**Splitting the responsibilities** keeps `MutationTestingService` as a lifecycle orchestrator (~560 lines: setup, baseline, plan, loop, rollback) while per-iteration evaluation (~270 lines: deploy, run, classify, build mutant result) lives in its own collaborator. Pure position/text utilities are shared between the executor's runtime path and the service's dry-run path via `mutationLocation.ts`.

**Exact coloring.** With `--mutation-grouping`, the planner unconditionally runs an exact graph-coloring step *after* DSATUR — `solveColoring` in `src/service/exactColoring.ts` binary-searches `k` between the lower bound and DSATUR's color count, calling `tryKColoring` (DSATUR-style backtracking) at each step.
The witness clique surfaced by D2 is pre-colored at the most-constrained vertices, so the search converges fast at our scale (`n ≤ 200`, χ typically single-digit).
The result is **never worse than DSATUR alone**: when DSATUR is already at the lower bound, the binary search short-circuits and the DSATUR coloring is returned with a "confirmed optimal" certificate; when DSATUR overshoots, the search returns a strictly smaller coloring.
The chosen path is reported through the existing `info.groupingPlan` line via a trailing `exact: …` suffix (`confirmed optimal` or `improved by N deploy(s)`). No external SAT solver, no runtime dependency.

### Proxy-Based Listener Aggregation

The central architectural pattern. `MutationListener` uses a JavaScript `Proxy` to dynamically dispatch ANTLR parse tree callbacks to all 25 registered mutators without explicit delegation.

```text
                        ┌──────────────────────┐
  ParseTreeWalker       │   MutationListener   │
  ─── enter*(ctx) ────► │      (Proxy)         │
                        │                      │
                        │  1. isLineEligible()  │
                        │     ├ coveredLines?   │
                        │     ├ allowedLines?   │
                        │     └ skipPatterns?   │
                        │                      │
                        │  2. Dispatch to all   │
                        │     sub-listeners     │
                        └──────┬───┬───┬───────┘
                               │   │   │
                 ┌─────────────┘   │   └─────────────┐
                 ▼                 ▼                  ▼
          ┌────────────┐  ┌────────────┐    ┌────────────┐
          │ Mutator A  │  │ Mutator B  │    │ Mutator N  │
          │enter*(ctx) │  │enter*(ctx) │    │enter*(ctx) │
          └─────┬──────┘  └─────┬──────┘    └─────┬──────┘
                │               │                  │
                └───────────────┼──────────────────┘
                                ▼
                    shared _mutations: ApexMutation[]
```

**How it works:**
- All `BaseListener` instances share the **same `_mutations` array** by reference assignment
- When any mutator calls `createMutation()`, it pushes to the shared array
- The Proxy intercepts every property access: if the property name matches an ANTLR `enter*`/`exit*` method, it creates a dispatcher function that calls the method on every sub-listener that implements it
- **Line eligibility filtering** happens once at the Proxy level via `isLineEligible(ctx.start.line)`, which encapsulates all line-level filters (see [Pertinent Mutant Detection](#pertinent-mutant-detection))

Line eligibility filtering is applied uniformly to all mutators — no exceptions.

### Structured Error Classification

A non-compiling mutant is **data returned by the port, not an exception thrown across it**
(ADR 087). `OrgMutationTestBed.evaluate` (`src/adapter/org/orgMutationTestBed.ts`) catches
`DeploymentFailedError` from the mutated deploy and returns a `MutantVerdict`:

```typescript
if (error instanceof DeploymentFailedError) {
  return { kind: 'not-compilable', detail: error.message }
}
throw error
```

`GroupExecutor.evaluateGroup` (`src/service/groupExecutor.ts`) reads that verdict directly —
`outcome.kind === 'not-compilable'` builds the `CompileError` mutant result — with no
`instanceof` check of its own, because the classification already happened at the port
boundary. `classifyRuntimeError` in the same file handles only what still *throws*: an
infrastructure failure (a network error, a poll timeout) that `GroupExecutor.runGroup`
catches as `unknown` and folds into the same `GroupOutcome` union as the port's own verdict
(`{ kind: 'threw'; error: unknown } | MutantVerdict`), so both the k>1 recursion predicate
and the k=1 leaf narrow over one discriminated union instead of a caught value and a returned
one:

```typescript
const classifyRuntimeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return {
    status: 'RuntimeError' as const,
    statusReason: message,
    progressMessage: `Mutation result: runtime error (${message})`,
  }
}
```

The localization rationale carries over unchanged from before the port extraction:
**Salesforce localizes platform API error messages to the org user's language**, so
`DeploymentFailedError`'s type check (now inside `OrgMutationTestBed.evaluate`) reads the
error's type, not its message text — a message match observed on an English-locale org
silently stops matching on any other. A live-org probe found this risk does *not* extend to
Apex runtime exception text: a `System.LimitException` came back in English from a
French-locale org in the same session where a platform API error came back in French, so the
two are localized independently — only the compile-fail path needs the structural guard.
Message text is still used for *reporting* — `progressMessage` and `statusReason` quote it
verbatim so the user sees the org's own diagnosis — just never for *classification*. A
governor-limit exception (e.g. too many SOQL queries) never reaches `classifyRuntimeError` at
all: the same probe found the org reports it as an ordinary failing test row over HTTP 200,
with no distinguishing error code anywhere in the row, message, or stack trace — the existing
per-method attribution in `attributeOutcomes` already scores it `Killed` because the row's
outcome is non-`Pass`.

### Domain Test Result Mapping

`ApexTestRunner` (`src/adapter/org/apexTestRunner.ts`) is the only file in `src/` that imports `@salesforce/apex-node`. Both transports return the vendor SDK's own `TestResult` shape; before either public method returns, the adapter maps that SDK DTO into `ApexTestRunResult` (`src/type/ApexTestRunResult.ts`) — a shape owned by this plugin, not mirrored from the vendor:

```typescript
const toApexTestRunResult = (testResult: TestResult): ApexTestRunResult => ({
  outcome: testResult.summary.outcome,
  tests: (testResult.tests ?? []).map(toApexTestMethodResult),
  classCoverage: testResult.codecoverage?.map(toApexClassCoverage),
})
```

Field names track what `src/service/` actually reads — `className`, `methodName`, `outcome`, `coverage`, `detail.coveredLines` — rather than the SDK's own vocabulary (`apexClass.fullName`, `perClassCoverage`, `codecoverage`). `CoverageStrategy` and `GroupExecutor` both consume `ApexTestRunResult` exclusively, so neither knows or cares which transport produced a result, and a future transport (or a breaking `@salesforce/apex-node` upgrade) only touches the mapping functions in `apexTestRunner.ts`.

### Strategy Pattern — Coverage Fidelity

Most orgs record per-test code coverage, but an org with **"Store Only Aggregated Code Coverage"** enabled (Setup → Apex Test Execution → Options) never populates it — only the cumulative, org-wide `ApexCodeCoverageAggregate` rollup is available. `src/service/coverageStrategy.ts` models the two coverage shapes as a `CoverageStrategy` interface with two implementations, both consuming the domain `ApexTestRunResult` (see Domain Test Result Mapping):

```typescript
interface CoverageStrategy {
  readonly fidelity: 'per-test' | 'aggregate'
  getTestMethodsPerLine(testResult: ApexTestRunResult): Map<number, Set<TestMethodId>>
}

class PerTestCoverageStrategy implements CoverageStrategy   // fidelity: 'per-test'
class AggregateCoverageStrategy implements CoverageStrategy // fidelity: 'aggregate'
```

`TestMethodId` (`src/type/TestMethodId.ts`) is a `ClassName.methodName` string, minted by `qualifyTestMethod(test.className, methodName)`. Both strategies qualify at this boundary — the one place a test method's declaring class is known — so a method name that exists in more than one perimeter class never collides downstream.

- `PerTestCoverageStrategy` filters each test's `coverage` entries down to the target class and maps each covered line to the set of qualified test-method ids that actually covered it, combining the contributions of every class in the perimeter.
- `AggregateCoverageStrategy` reads the target class's entry from `testResult.classCoverage` and assigns **every** covered line the full set of qualified ids of every executed test method across the perimeter — an over-approximation, since the aggregate rollup does not distinguish which test covered which line. This is the accepted "every test method runs per mutant" degradation.
- Both strategies lower-case the target class name once in their constructor for case-insensitive matching.

**Selection is knowledge, not inference — made where the baseline is computed.**
`OrgMutationTestBed.prepare` (`src/adapter/org/orgMutationTestBed.ts`) queries
`ApexSettingsRepository.isAggregateCoverageOnly()` (a Tooling API read of
`ApexSettings.IsAggregateCodeCoverageOnlyEnabled`) and picks the strategy before running the
baseline test:

```typescript
const strategy = (await this.settings.isAggregateCoverageOnly())
  ? new AggregateCoverageStrategy(this.apexClassName)
  : new PerTestCoverageStrategy(this.apexClassName)
```

The two strategy classes are unmoved — they still live in `src/service/coverageStrategy.ts`
— only the *selection* crossed into the org engine, because it is org-specific knowledge (a
Tooling API read) that a future non-org engine would not share (ADR 090).
`MutationTestingService` never selects a strategy itself; it reads the chosen fidelity back
off the returned `Baseline.fidelity` — `stopBaselineSpinner` and
`reducePerimeterFromBaseline`'s zero-contribution check both branch on it — rather than
holding a reference to the strategy instance.

The chosen strategy is injected into
`ApexTestRunner.getTestMethodsPerLines(apexTestClassNames, coverageStrategy)`, which
delegates all coverage shaping to it and — this is load-bearing — excludes a `CompileFail`
row (via `partitionOutcomes`) **before** the strategy ever sees a test result: a compile
failure is not a coverage fact, and letting either strategy see the row would attribute
failed-to-compile "coverage" to whichever class the response happens to name. The adapter no
longer guesses from the shape of an empty map — it is simply told which fidelity to use.

### Transport Selection — Synchronous vs. Asynchronous Test Runs

`ApexTestRunner` (`src/adapter/org/apexTestRunner.ts`) sends every test run — baseline and per-mutant alike — through one of two Tooling API transports, chosen by one private seam both public methods funnel through:

```typescript
const SYNC_ELIGIBLE_TEST_CLASS_COUNT = 1

private async runTests(tests: TestItems, coverage: CoverageRequest) {
  return tests.length === SYNC_ELIGIBLE_TEST_CLASS_COUNT &&
    !this.syncTransportDisabled
    ? this.runPreferringSync(tests, coverage)
    : this.runTestAsynchronous(tests, coverage)
}
```

`coverage` is a named `CoverageRequest` (`'with-coverage' | 'without-coverage'`) rather than a negated `skipCodeCoverage` boolean threaded through the call chain — the vendor SDK asks for the same intent twice per call (a `skipCodeCoverage` payload field and a separately negated positional argument), so both are derived once, at the transport methods, from this single domain value.

**Why it exists.** The asynchronous transport draws on the org's `DailyAsyncApexTests` limit (500 per rolling 24h) on every kickoff; there is no synchronous counterpart limit. A mutation testing campaign is inherently test-run-heavy — one run per mutation group, plus the baseline — so a single-class perimeter can exhaust the async limit inside a single run. While exhausted, `sf apex run test` fails **org-wide**, for every class, with `UNKNOWN_EXCEPTION` — a failure mode that reads as a plugin defect rather than a quota.

**What it does.** Class count is the whole predicate — no method-count cap, no duration estimate. `getTestMethodsPerLines` (the baseline) and `runTestMethods` (the per-mutant run) both route through `runTests`, so the baseline obeys the identical rule: a perimeter naming exactly one Apex class runs the **entire** campaign — baseline and every mutant — through the synchronous transport, at **zero** `DailyAsyncApexTests` cost. A payload naming two or more classes stays asynchronous. Both payloads set `maxFailedTests: 0`, so either transport stops at the first failure.

Measured on the E2E fixture, this drops the campaign's queued async test classes from roughly 58 to 12 — about 8 campaigns per day to 41 before the org-wide limit bites. Measured against a real org, 12 synchronous runs consumed zero `DailyAsyncApexTests` units, and 3 asynchronous runs consumed exactly 3.

There is no flag and no config key for any of this: the behaviour is unconditional, on every run, with no opt-out.

**The permission floor.** `runTestsSynchronous` requires the **View Setup** user permission; the asynchronous path never needed it. A thrown sync error is classified by its structured `errorCode`, the same discipline that would apply to any typed platform error code: `INSUFFICIENT_ACCESS_OR_READONLY` and `INSUFFICIENT_ACCESS` mean the *capability* itself is missing, so they latch `syncTransportDisabled` on the adapter instance — every later single-class call for the rest of the campaign skips the synchronous attempt entirely, costing exactly one wasted round-trip total rather than one per group. Any other error (a lock contention, a transient 503, and the like) is treated as transient and the synchronous transport is retried on the next call. Either way the exact same payload falls back to the asynchronous transport, and the fallback call is issued *before* the reason is reported, so a throwing report callback can never preempt the fallback attempt itself. The reason is reported only the first time it happens, through a private reporting latch on the adapter instance, separate from the transport latch — `ApexTestRunner` carries no UI dependency of its own; it calls its own `onSyncFallback(error)` callback and nothing else. That callback is wired up once, in `src/adapter/org/orgEngine.ts`, to `ctx.notify({ kind: 'sync-transport-fallback', error })` — the one `EngineNotice` member today — and `run.ts` supplies `notify` as `notice => reportEngineNotice(notice, this.spinner, messages)` (ADR 093). `reportEngineNotice` (`src/service/engineNotice.ts`) is where the presentation lives: it uses `spinner.pause`, not the start/stop pair the rest of this service relies on (`stop()` no-ops when nothing is running, `start()` replaces the current task without stopping it, so that idiom would silently swallow a later "Original tests passed"), and it sanitizes and truncates the org-supplied reason — `renderOrgDetail`, bounded at 200 code points (`MAX_ORG_ERROR_DETAIL_LENGTH`) — the same discipline the rollback-failure cause uses, in the same module, before writing through the injected `OutputSink` rather than `process.stdout` directly. If an asynchronous retry itself throws, that error propagates untouched to the same classification path every async failure already goes through.

**A synchronous compile failure is normalized, not thrown.** The synchronous resource represents a non-compiling test class as an ordinary HTTP 200 carrying a plain `Fail` row (`methodName: null`, `runTime: -1`, `summary.testsRan: 0`) — it never throws, so the fallback above cannot catch it. `runTestSynchronous` recognizes this exact fingerprint (row count, `methodName`, `runTime`, and both `summary` fields together) and rewrites the result into the `CompileFail` shape the asynchronous transport already produces for the same failure, so `partitionOutcomes` treats both transports identically. A partial match is left untouched — fail closed, so a real test failure is never mistaken for a compile skip.

A hybrid campaign (some groups synchronous, some asynchronous) finishes **sooner** than `displayTimeEstimate` (`src/service/mutationTestingService.ts`) predicts: the estimate extrapolates a fixed per-mutant cost from the baseline's measured timing, and a synchronous run skips the asynchronous transport's polling loop entirely. Over-predicting is the benign direction — it is not a bug.

### Template Method — BaseListener

`BaseListener` provides the mutation-creation infrastructure; subclasses override ANTLR `enter*` hooks to define **when** and **what** to mutate:

```text
BaseListener (abstract behavior)
  ├─ createMutation(startToken, endToken, text, replacement)
  ├─ createMutationFromParserRuleContext(ctx, replacement)
  ├─ createMutationFromTerminalNode(node, replacement)
  └─ getEnclosingMethodName(ctx)

Concrete mutators override:
  ├─ enterReturnStatement(ctx)         → EmptyReturnMutator
  ├─ enterCmpExpression(ctx)           → BoundaryConditionMutator
  ├─ enterExpressionStatement(ctx)     → VoidMethodCallMutator
  └─ ...
```

### Repository Pattern — Adapter Layer

Four repository classes isolate the org's Tooling API / `@salesforce/apex-node` surface.
They are internals of the org engine now (`src/adapter/org/`, ADR 084): nothing outside that
directory imports them. `orgEngine.ts` (`createOrgEngine`) wires them into the port
implementations `src/service/` and `src/commands/` actually depend on —
`OrgApexSourceProvider` wraps `ApexClassRepository` + `ApexTestSuiteRepository`, and
`OrgMutationTestBed` wraps `ApexClassRepository`, `ApexTestRunner`, and
`ApexSettingsRepository` — and hands both, plus `OrgSObjectSchemaProvider`, to the rest of
the codebase as one `EngineBundle` (see
[Execution Ports](#execution-ports)).

| Repository | API | Purpose |
| --- | --- | --- |
| `ApexClassRepository` | Tooling API | CRUD on ApexClass, MetadataContainer deployment |
| `ApexTestRunner` | @salesforce/apex-node | Test execution with/without coverage, synchronous or asynchronous by payload class count |
| `ApexSettingsRepository` | Tooling API | Reads `IsAggregateCodeCoverageOnlyEnabled` to select the coverage strategy |
| `ApexTestSuiteRepository` | Tooling API | Resolves ApexTestSuite names to member Apex test class names |

The fifth pre-port collaborator, SObject describe, has no repository behind it anymore:
`OrgSObjectSchemaProvider` (`src/adapter/org/orgSObjectSchemaProvider.ts` — the renamed
`SObjectDescribeRepository`) implements `SObjectSchemaProvider` directly against
`Connection.describe`, with no intermediate class to wrap.

### Builder/Fluent API — TypeDiscoverer

```typescript
new TypeDiscoverer()
  .withMatcher(apexClassMatcher)
  .withMatcher(sObjectMatcher)
  .analyze(code)
```

### Shared Mutable State

The `_mutations` array is shared by reference across all listeners. This is safe because ANTLR tree walking is **synchronous** — no concurrent writes.

`MutationListener` also keeps a per-instance
`dispatchCache: Map<propName, BaseListener[]>` memoising which listeners
implement each ANTLR hook. The Proxy trap used to rescan all 25 mutators on
every AST-node callback to answer
"`prop in listener && typeof listener[prop] === 'function'`". The cache
makes subsequent calls `O(K)` where `K` is the subset that actually
implements the hook. The cache is scoped to the Proxy instance, which is
short-lived (one per `compute()` call), so it cannot go stale.

### Line/Column Derivation

ANTLR tokens already carry `line` (1-indexed) and `charPositionInLine`
(0-indexed) for their first character, so the Stryker `start` position is
read directly from `startToken`. The only computation needed is the `end`
position, which is exclusive (one past the last char of the `endToken`).
A small `advancePosition(text, startLine, startColumn)` helper walks
`endToken.text` and advances the cursor, correctly handling tokens whose
text spans newlines (multi-line string literals, block comments).

---

## Type-Awareness System

Type-aware mutators need to understand Apex types to generate valid mutations (e.g., returning `0` for Integer methods, `''` for String methods). This is a two-phase system:

### Phase 1: Type Discovery (ANTLR Parse #1)

```text
                    Source Code
                        │
                        ▼
                  ┌───────────┐
                  │ ApexLexer │
                  └─────┬─────┘
                        ▼
                  ┌───────────┐
                  │ApexParser │
                  └─────┬─────┘
                        ▼
              ┌───────────────────┐
              │TypeDiscoverListener│
              │                   │
              │ enterMethodDecl   │──► methodTypeTable
              │ enterLocalVarDecl │──► variableScopes
              │ enterFormalParam  │──► variableScopes
              │ enterEnhancedFor  │──► variableScopes
              │ enterCatchClause  │──► variableScopes
              │ exitMethodDecl    │──► seal scope
              │ enterFieldDecl    │──► classFields
              │                   │
              │ collectToMatchers │──► TypeMatcher.collect()
              └─────────┬────────┘
                        ▼
              ┌───────────────────┐
              │ TypeMatcher[]     │
              │                   │
              │ ApexClassType     │──► matches(typeName)
              │   Matcher         │    by dependency set
              │                   │
              │ SObjectType       │──► matches(typeName)
              │   Matcher         │    by dependency set
              │                   │──► populate() → describe()
              │                   │──► getFieldType(obj, field)
              └─────────┬────────┘
                        ▼
              ┌───────────────────┐
              │   TypeRegistry    │
              │                   │
              │ resolveType(      │
              │   method,         │
              │   expression?)    │
              │ → ResolvedType    │
              └───────────────────┘
```

### Phase 2: Type Resolution at Mutation Time

Phase 2 reuses the tree + tokenStream from phase 1; only the walker and listeners are fresh. `TypeRegistry.resolveType()` handles four expression forms:

| Expression Form | Example | Resolution Strategy |
| --- | --- | --- |
| No expression | `resolveType('calculate')` | Method return type lookup |
| With `(` | `resolveType('m', 'getTotal()')` | Strip `()`, lookup method return type |
| With `.` | `resolveType('m', 'acc.Name')` | Resolve root variable, then field via matcher |
| Plain name | `resolveType('m', 'rate')` | Method scope → class fields → classify |

Variable resolution priority: **method-local scope > class fields** (shadowing).

### Type Domain Predicates

Type-domain questions live in `TypeRegistry`, not in mutators or `BaseListener`:

| Method | Used by | Purpose |
| --- | --- | --- |
| `isNumericOperand(method, expr)` | `ArithmeticOperatorMutator`, `ArithmeticOperatorDeletionMutator`, `UnaryOperatorInsertionMutator` | Returns `false` for string literals and non-numeric resolved types; `true` (permissive) when type is unresolvable |
| `isNumericReturn(method)` | `NegationMutator` | Returns `true` only when the method's return type is a numeric primitive |

`NUMERIC_TYPES` (Integer, Long, Double, Decimal) is defined once in `TypeRegistry.ts`. Adding support for new numeric-domain predicates requires changing only this file.

### Type Classification

`classifyApexType()` maps type names to `ApexType` enum values:

```text
Input typeName
    │
    ├─ lowercase match in PRIMITIVE_TYPE_MAP? ──► BOOLEAN, INTEGER, STRING, ...
    │   (14 primitive types)
    │
    ├─ starts with 'list<' or ends with '[]'? ──► LIST
    ├─ starts with 'set<'?                    ──► SET
    ├─ starts with 'map<'?                    ──► MAP
    │
    ├─ any TypeMatcher.matches()?             ──► OBJECT
    │
    └─ otherwise                              ──► VOID (conservative fallback)
```

---

## ANTLR Parse Tree Processing

Two independent ANTLR parses are performed:

```text
Source Code ─── Parse #1 (TypeDiscoverer) ──► TypeRegistry
            │
            └── Parse #2 (MutantGenerator) ──► AST + TokenStream
                     │
                     ├─ ParseTreeWalker.walk(MutationListener, tree)
                     │    └─ Proxy dispatches to 25 mutators
                     │       └─ each pushes to shared _mutations[]
                     │
                     └─ TokenStreamRewriter (reused for all mutations)
                          └─ .replace(startIdx, endIdx, replacement)
                          └─ .getText() → mutated source string
```

`TokenStreamRewriter` is non-destructive — each `mutate()` call creates a fresh rewriter from the same token stream, producing an independent mutated source.

---

## Mutation Operators

### 26 Mutation Operators by Category

```text
┌──────────────────────────────────────────────────────────────────┐
│                    OPERATOR REPLACEMENT                          │
│                                                                  │
│  BoundaryConditionMutator    < ↔ <=   > ↔ >=                    │
│  EqualityConditionMutator    == ↔ !=                             │
│  ArithmeticOperatorMutator   + ↔ - ↔ * ↔ / (with string guard)  │
│  LogicalOperatorMutator      && ↔ ||                             │
│  IncrementMutator            ++ ↔ --                             │
│  BitwiseOperatorMutator      & ↔ | ↔ ^                          │
├──────────────────────────────────────────────────────────────────┤
│                    STATEMENT DELETION                            │
│                                                                  │
│  VoidMethodCallMutator       receiver.method(args); → (deleted)  │
│  RemoveIncrementsMutator     i++ → i  (skips post-op in return)  │
│  ArithmeticOperatorDeletion  a + b → a  or  a + b → b           │
│  LogicalOperatorDeletion     a && b → a  or  a && b → b         │
├──────────────────────────────────────────────────────────────────┤
│                 RETURN VALUE MUTATION                             │
│                                                                  │
│  EmptyReturnMutator          return x → return <default>         │
│  NullReturnMutator           return x → return null              │
│  TrueReturnMutator           return x → return true              │
│  FalseReturnMutator          return x → return false             │
│  NegationMutator             return x → return -x                │
│  InvertNegativesMutator      return -x → return x                │
├──────────────────────────────────────────────────────────────────┤
│                CONTROL FLOW MUTATION                              │
│                                                                  │
│  RemoveConditionalsMutator   if(cond) → if(true) / if(false)    │
│  SwitchMutator               when X { body } → when X { }       │
│  ExperimentalSwitchMutator   swap first two when blocks          │
├──────────────────────────────────────────────────────────────────┤
│              TYPE-AWARE METHOD MUTATIONS                          │
│                                                                  │
│  NonVoidMethodCallMutator    x = foo() → x = <default_for_type> │
│  ArgumentPropagationMutator  foo(a, b) → a  (if types match)    │
│  NakedReceiverMutator        obj.method() → obj (if types match)│
├──────────────────────────────────────────────────────────────────┤
│                  CONSTANT MUTATION (PIT CRCR)                    │
│                                                                  │
│  InlineConstantMutator       42 → 0,1,-1,43,41                  │
│                              42L → 0L,1L,-1L,43L,41L            │
│                              3.14 → 0.0,1.0,-1.0,4.14,2.14     │
│                              'hello' → ''                        │
│                              true ↔ false                        │
│                              null → type-appropriate default     │
├──────────────────────────────────────────────────────────────────┤
│                     OTHER                                        │
│                                                                  │
│  ConstructorCallMutator      new T(...) → null                   │
│  MemberVariableMutator       Integer x = 5 → Integer x          │
│  UnaryOperatorInsertionMutator  x → ±x  (numeric vars/params only)│
└──────────────────────────────────────────────────────────────────┘
```

### Type-Awareness Requirements

| Mutator | Needs TypeRegistry | Reason |
| --- | --- | --- |
| EmptyReturnMutator | Yes | Default value depends on return type |
| NullReturnMutator | Yes | Must skip void methods |
| TrueReturnMutator | Yes | Must target boolean methods only |
| FalseReturnMutator | Yes | Must target boolean methods only |
| NegationMutator | Yes | Must target numeric methods only |
| NonVoidMethodCallMutator | Yes | Default value depends on LHS type |
| ArgumentPropagationMutator | Yes | Must match argument type to return type |
| NakedReceiverMutator | Yes | Must match receiver type to return type |
| ArithmeticOperatorMutator | Yes | Must skip string concatenation (`+`) |
| ArithmeticOperatorDeletionMutator | Yes | Must skip string concatenation (`+`) |
| UnaryOperatorInsertionMutator | Yes | Must target numeric variables/parameters only |
| InlineConstantMutator | Yes | Null literal replacement depends on declared/return type |

---

## Equivalent Mutant Avoidance

An **equivalent mutant** is one that modifies code but produces identical observable behaviour — no test can ever kill it. Generating equivalent mutants wastes org deployment cycles and distorts the mutation score. The following static guards are applied at generation time to avoid producing them.

### Post-Operator in Return Context

`return x++` returns the pre-increment value of `x`, identical to `return x`. Only the side-effect (incrementing `x`) differs, but a local variable mutation in a return statement is never observable.

| Mutator | Guard |
| --- | --- |
| `RemoveIncrementsMutator` | Skips post-op deletion (`i++ → i`) when inside a `return` statement |
| `UnaryOperatorInsertionMutator` | Skips post-op insertion (`x → x++`, `x → x--`) when inside a `return` statement; pre-ops (`++x`, `--x`) are still generated |

### Arithmetic Identity Elements

Replacing `a + 0` with `a` (or `a * 1` with `a`) is always a no-op — the identity property guarantees semantic equivalence regardless of the value of `a`.

`ArithmeticOperatorDeletionMutator` skips the operand that would produce an equivalent result:

| Expression | Skipped mutation | Reason |
| --- | --- | --- |
| `a + 0`, `a - 0` | `a + 0 → a` | Adding or subtracting zero is identity |
| `0 + b` | `0 + b → b` | Zero is left-identity for `+` |
| `a * 1`, `a / 1` | `a * 1 → a` | Multiplying or dividing by one is identity |
| `1 * b` | `1 * b → b` | One is left-identity for `*` |

Zero is matched as `0`, `0L`, `0.0`, `0.0d`, etc. One is matched as `1`, `1L`, `1.0`, `1.0d`, etc.

### Logical Identity Elements

`a && true` is always equal to `a`, and `a || false` is always equal to `a` — these are the identity elements for logical AND and OR.

`LogicalOperatorDeletionMutator` skips the deletion that would produce an equivalent result:

| Expression | Skipped mutation | Reason |
| --- | --- | --- |
| `a && true` | `a && true → a` | `true` is right-identity for `&&` |
| `true && b` | `true && b → b` | `true` is left-identity for `&&` |
| `a \|\| false` | `a \|\| false → a` | `false` is right-identity for `\|\|` |
| `false \|\| b` | `false \|\| b → b` | `false` is left-identity for `\|\|` |

### Null-Initialized Member Variables

In Apex (unlike Java), every field type defaults to `null` when no initializer is present. Mutating `private String name = null` to `private String name` would always produce identical behaviour.

`MemberVariableMutator` skips field declarations whose initializer is the literal `null`.

### No-Op Condition Replacement

Replacing a condition with a constant it already equals (`if (true) → if (true)`) is a no-op.

`RemoveConditionalsMutator` skips the `→ (true)` mutation when the condition text is already `(true)`, and the `→ (false)` mutation when it is already `(false)`.

---

## Deployment Mechanism

Each mutation is deployed using the Tooling API **MetadataContainer** pattern, wrapped in a `try { … } finally { deleteContainer(id) }` so orphaned containers don't accumulate on the target org:

```text
┌─────────────────────┐
│  MetadataContainer   │  Name: MutationTest_{timestamp}
│  (create)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  ApexClassMember     │  MetadataContainerId ──► container.id
│  (create)            │  ContentEntityId ──────► apexClass.Id
│                      │  Body ─────────────────► mutated source
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ContainerAsyncRequest │  MetadataContainerId ──► container.id
│  (create)            │  IsCheckOnly: false
│                      │  IsRunTests: true by default; false only for the
│                      │  failure-path rollback restore
└──────────┬──────────┘
           │
           ▼
     ┌───────────┐   exponential backoff
     │  Polling   │◄────────────────────┐
     │  Loop      │   100ms → 2s        │
     └─────┬─────┘   (factor 1.5)       │
           │                            │
     ┌─────▼─────┐    No    ┌──────────┴─┐
     │ Terminal   ├─────────►│  Retrieve  │
     │ State?     │          │  + sleep   │
     └─────┬─────┘          └────────────┘
           │ Yes                │
           │                    │ Date.now() > deadline?
           │                    ▼
           │               PollTimeoutError
           │               (default 5 min; configurable)
           ▼
  Completed | Failed | Error | Aborted
           │
           ▼
  ┌────────────────────────────────────┐
  │ finally {                          │
  │   fire-and-forget                  │
  │   MetadataContainer.delete(id)     │
  │   — rejections swallowed; Salesforce│
  │     reaps after 24h on failure      │
  │ }                                  │
  └────────────────────────────────────┘
```

**Poll configuration**. `PollOptions = { initialIntervalMs?, maxIntervalMs?, timeoutMs? }` is validated at construction: negative intervals and the racy `timeoutMs === 0` throw. A negative `timeoutMs` is accepted as "immediate timeout" for test harnesses.

`RUN_TESTS` / `SKIP_TESTS` and the `RestorePolicy` type they form live in
`src/port/mutationTestBed.ts` — a port module, not `src/adapter/org/apexClassRepository.ts`
where they lived before the port extraction — because `MutationTestBed.restore(policy)` is a
method on the port's own interface. `ApexClassRepository.update(apexClass, testPolicy:
RestorePolicy = RUN_TESTS)` imports them back from the port. `OrgMutationTestBed.restore` is
the only caller that ever passes the non-default `SKIP_TESTS`, on the failure-path rollback
described in [`process()` Method Decomposition](#process-method-decomposition) — the org has
usually just exhausted a test-run quota when that path runs, so skipping tests on the restore
deploy is also the cheapest request the plugin can still make.

---

## Scoring Algorithm

```text
                    All Mutants
                        │
            ┌───────────┼───────────┐
            │           │           │
        CompileError  Valid      RuntimeError
        (excluded)    Mutants    (counted as killed)
                        │
              ┌─────────┼─────────┐
              │                   │
           Killed              Survived
          (detected)          (undetected)

  Score = |Killed ∪ RuntimeError| / |Valid Mutants| × 100

  Where Valid Mutants = All Mutants - CompileErrors
```

A higher score means the test suite is better at detecting mutations. `RuntimeError` is counted as killed because a runtime exception indicates the test detected a problem.

---

## Targeted Test Execution

A key performance optimization: only the test methods that **cover the mutated line** are executed per mutation, taking the union across every class in the `-t` perimeter.

```text
Baseline Test Run (synchronous for a single-class perimeter, asynchronous otherwise — see Transport Selection)
    │
    ▼
testMethodsPerLine: Map<line, Set<TestMethodId>>   TestMethodId = "ClassName.methodName"
    │
    │  Line 10 → { FooTest.testA, BarTest.testB }
    │  Line 15 → { FooTest.testA }
    │  Line 20 → { FooTest.testB, BarTest.testB }
    │
    ▼
Mutation on Line 15:
    → only run FooTest.testA

Mutation on Line 20:
    → only run FooTest.testB, BarTest.testB
```

Qualifying the token by its declaring class — minted once at the org boundary by both `CoverageStrategy` implementations and reused by `GroupExecutor` for outcome attribution — is what keeps kill/survive verdicts exact when two perimeter classes declare a method with the same name; a bare `methodName` map would silently collapse `FooTest.testA` and `BarTest.testA` into one entry.

This dramatically reduces the number of test executions per mutation cycle.

---

## HTML Report Generation

The reporter transforms internal results to the [Stryker Mutation Testing Report Schema v2](https://github.com/stryker-mutator/mutation-testing-elements):

```text
ApexMutationTestResult
    │
    ├─ resolveSafeOutputDir(outputDir)
    │   ├─ caller (run.ts) has already validated that outputDir
    │   │  exists via oclif `Flags.directory({ exists: true })`.
    │   │  The reporter does NOT mkdir: the plugin may be installed
    │   │  under a more privileged user than the invoker, and
    │   │  auto-creating paths would let a crafted -r flag write
    │   │  into places the invoker cannot otherwise reach.
    │   ├─ path.resolve must be inside process.cwd()
    │   └─ realpath(outputDir) must also be inside cwd — blocks
    │      symlinks whose target is outside the project root
    │
    ├─ transformApexResults()
    │   ├─ testFiles?: keyed by every class in the perimeter, in
    │   │   user-supplied order. Each entry lists that class's
    │   │   observed test methods as { id, name } — id and name are
    │   │   both the qualified "ClassName.methodName" — sorted; a
    │   │   perimeter class that covered no tested mutant still gets
    │   │   an entry with tests: []. Built from the union of every
    │   │   mutant's coveredBy; the whole key is OMITTED (not an
    │   │   empty object) when that union is empty — dry run, or
    │   │   every mutant a CompileError — so the app renders no test
    │   │   view at all.
    │   ├─ language: 'java' (Apex ≈ Java for highlighting)
    │   ├─ source: original Apex source
    │   └─ mutants[]:
    │       ├─ id, mutatorName, replacement
    │       ├─ status: Killed|Survived|NoCoverage|CompileError|RuntimeError|Pending
    │       ├─ coveredBy? / killedBy?: qualified TestMethodIds
    │       │   ("ClassName.methodName") read off the mutant's
    │       │   attribution. Both absent when the mutant carries no
    │       │   attribution (CompileError, RuntimeError, Pending —
    │       │   no test outcomes were observed); killedBy is also
    │       │   omitted, not emitted empty, when nothing killed it.
    │       ├─ testsCompleted: covering methods that actually
    │       │   reported before the run bailed. maxFailedTests: 0
    │       │   aborts the run at the first failure on either
    │       │   transport, so this is normally lower than
    │       │   coveredBy.length on a killed mutant — that gap is
    │       │   expected, not a bug.
    │       └─ location: { start: {line,column}, end: {line,column} }
    │
    ├─ loadMutationTestElements()
    │   └─ createRequire + readFile from the vendored
    │      `mutation-testing-elements` npm package (no CDN)
    │
    ├─ serializeReportForScript() → neutralise every
    │   context-escape sequence before inlining JSON:
    │     </  → <\/
    │     <!--  → <\!--
    │     -->   → --\>
    │     <script (case-insensitive) → <\script
    │     U+2028 / U+2029 → \u2028 / \u2029
    │
    └─ HTML template (bundle inlined, data in a data island):
        <script>{vendored mutation-testing-elements JS}</script>
        <mutation-test-report-app>
        <script id="mutation-report-data" type="application/json">
          {neutralised JSON}
        </script>
        <script>
          app.report = JSON.parse(
            document.getElementById('mutation-report-data').textContent
          );
        </script>
```

This layout avoids the three classes of attack the old `app.report = { … }` inline assignment left open: script-data end tags inside mutant source, CDN tampering, and U+2028/2029 injection. It also keeps e2e snapshots small — the `tooling/normalize-e2e-snapshot.mjs` script strips the inlined bundle before committing.

---

## Data Flow Summary

```text
                  Salesforce Org
                 ┌──────────────┐
                 │  ApexClass   │◄──── read / update (deploy mutant / rollback; failure-path rollback skips tests)
                 │  TestService │◄──── runTestSynchronous / runTestAsynchronous (baseline + per-mutant)
                 │  Describe    │◄──── SObject field metadata
                 └──────┬───────┘
                        │
              ┌─────────▼──────────┐
              │ src/adapter/org/    │
              │ Repository + Runner │
              │ (implements ports)  │
              └─────────┬──────────┘
                        │  EngineBundle (src/port/ interfaces,
                        │  built once by adapter/org/orgEngine.ts)
         ┌──────────────▼──────────────┐
         │    MutationTestingService   │
         │                             │
         │  source ──► TypeDiscoverer  │
         │              │              │
         │         TypeRegistry        │
         │              │              │
         │  source ──► MutantGenerator │
         │              │              │
         │         ApexMutation[]      │
         │              │              │
         │    ┌─────────▼──────────┐   │
         │    │   per mutation:    │   │
         │    │  mutate → deploy   │   │
         │    │  → test → classify │   │
         │    └────────────────────┘   │
         │              │              │
         │    ApexMutationTestResult   │
         └──────────────┬──────────────┘
                        │
              ┌─────────▼──────────┐
              │    Reporters       │
              │                    │
              │  HTMLReporter      │
              │  → Stryker schema  │
              │  → HTML report     │
              │  (both paths)      │
              └────────────────────┘
```

---

## Testing Strategy

Four test tiers with distinct scopes and runners:

```text
┌────────────────────────────────────────────────────────────┐
│  E2E Tests (shell scripts, real org, post-publish)         │
│  npm run test:e2e                                          │
│  setup → execute command → git diff snapshot → teardown    │
├────────────────────────────────────────────────────────────┤
│  NUT Tests (Vitest, mocked Connection)                     │
│  vitest run --config vitest.config.nut.ts                  │
│  SfCommand.run() with mocked org, validators, services     │
├────────────────────────────────────────────────────────────┤
│  Integration Tests (Vitest, real ANTLR parsing)            │
│  test/integration/*.integration.test.ts                    │
│  Source → parse → mutate → verify mutations                │
├────────────────────────────────────────────────────────────┤
│  Unit Tests (Vitest, 100% coverage threshold)              │
│  test/unit/**/*.test.ts                                    │
│  Isolated class/function tests with mocked dependencies    │
└────────────────────────────────────────────────────────────┘
```

| Tier | Runner | Config | Org Required | Speed | Scope |
| --- | --- | --- | --- | --- | --- |
| Unit | Vitest | `vitest.config.ts` | No | ~8s | Class-level isolation |
| Integration | Vitest | `vitest.config.ts` | No | Included in unit run | ANTLR parse + mutate |
| NUT | Vitest | `vitest.config.nut.ts` | No (mocked) | ~1.5s | Command-level with mocked org |
| E2E | npm scripts | N/A | Yes | Minutes | Full plugin command against real org |

**NUT tests** use Vitest's `vi.mock()` (auto-hoisted) with static imports to mock `@salesforce/core` and `@salesforce/sf-plugins-core` at the module level. Variables read directly inside mock factories are declared with `vi.hoisted()` to ensure they are initialized before factory execution.

**E2E tests** run the published plugin command via `sf apex mutation test run`,
normalize the generated HTML report (parse embedded JSON, sort mutants deterministically
by line/column/mutatorName/replacement, replace volatile timestamps), then validate via
`git diff` against a committed HTML snapshot. The validate step displays the diff before
failing for CI debugging. Teardown (class redeployment) always executes even on failure.

**Unit coverage of the execution-ports layering** adds three surfaces under `test/unit/`,
alongside the existing `test/unit/service/` and `test/unit/mutator/` trees: `test/unit/port/`
covers the port modules' own exports that need no adapter — `CompilationCheckFailedError`
and the `RUN_TESTS`/`SKIP_TESTS` distinctness — since the port interfaces themselves are
type-only and generate no runtime surface to test; `test/unit/adapter/org/` covers the org
engine's port implementations and the four repositories they wrap, including
`OrgMutationTestBed`'s prepare-before-evaluate/restore precondition guard, which is
unreachable by construction and so must be driven directly from a test; and the NUT suite
covers the command's wiring of `createOrgEngine` end to end (see
[Execution Ports](#execution-ports)).

**Test fixtures** (`test/classes/Mutation.cls`, `MutationTest.cls` and `MutationBulkTest.cls`)
are shared across NUT and E2E tiers. `Mutation.cls` contains constructs triggering all 25
mutators. `MutationTest.cls` provides 100% line coverage. `MutationBulkTest.cls` is the second
perimeter class the E2E run exercises `-t MutationTest,MutationBulkTest` against: it declares
one method, `testNum`, deliberately colliding with `MutationTest.testNum` while covering only
`Mutation.num`, so the collision is observable without doubling every mutant's attribution or
the run's async-test consumption.

---

## Self-Mutation Testing Infrastructure

The project uses [Stryker](https://stryker-mutator.io/) to measure the quality of its **own** test suite. This is meta-testing: Stryker mutates the TypeScript source (`src/`) and runs the Vitest tests to verify that mutations are detected.

```shell
npm run test:mutation
```

The HTML report is written to `reports/mutation/index.html`.

### Infrastructure Files

| File | Purpose |
| --- | --- |
| `stryker.config.mjs` | Stryker configuration — runner, scope, reporters, thresholds |
| `vitest.config.mutation.ts` | Vitest config for mutation runs — includes both unit and integration tests |

`coverageAnalysis: 'perTest'` enables per-test mutation filtering — only tests that cover a mutated line are run for that mutant, dramatically reducing execution time.

### Score Baseline

| Metric | Value |
| --- | --- |
| Total mutants | 3273 |
| Killed | 3232 |
| Timeout | 30 |
| Survived (equivalent) | 11 |
| **Mutation score** | **99.66%** |

Refreshed after the execution-ports refactor (`src/port/`, `src/adapter/org/`). The total moved for **two reasons at once**, so the raw delta against
the prior baseline (2333 total, 94.51%) is not a single-cause comparison: `src/port/**/*.ts`
joined `stryker.config.mjs`'s `mutate` scope in Part 2 of this refactor (four new files with
their own mutants), and the refactor itself is new/rewritten code across
`src/adapter/org/` (three new port implementations plus `orgEngine.ts`) and `src/service/`
(`mutationTestingService.ts`, `groupExecutor.ts` restructured around the port).

**This baseline predates the rescope that removed the engine factory, the `concurrency`
member and the disposal contract, so it should be re-measured before being diffed against a
fresh report.**

The survivor count fell sharply even as the mutant count grew (128 → 11): most of the
previously-documented equivalent survivors lived in code this refactor rewrote outright
(`verifyCompilation`, `selectCoverageStrategy`, `evaluateMutation`/`classifyError` — all gone,
replaced by `testBed.prepare`/`evaluate` and `GroupExecutor.evaluateGroup`), and the new code
was built under the same 100 % coverage gate plus the golden-UI-sequence and edge-matrix
tests this refactor added, which killed mutants the old, more loosely-tested code left
standing. Ten of the eleven current survivors are byte-identical carryovers from files this
refactor moved but did not rewrite (`apexClassRepository.ts`, `apexTestRunner.ts`,
and single-element-array edge cases in `groupExecutor.ts`/`mutationTestingService.ts` that
predate this branch) — confirmed by diffing each surviving line against `main`. They are not
re-audited here; they fall under categories 1-5 below, already accepted before this refactor
started. Only one survivor is new to this branch, and it is called out under category 6.

### Confirmed Equivalent Survivors

The current survivors are all confirmed equivalent — no additional test can ever kill them.
They fall into six categories:

**1. ANTLR grammar guarantees**

The ANTLR `apex-parser` always produces well-formed parse trees. Guards that check structural invariants of valid AST nodes are dead code: `ctx.childCount > 0`, `node instanceof TerminalNode`, `ctx.start !== null`, `ctx.stop !== null`. Mutations that replace these guards with constants survive because the guarded path is never reached with a non-conforming value.

**2. Dead fields (`ApexMethod`)**

`ApexMethod.startLine` and `ApexMethod.endLine` are stored but never read by any downstream consumer. Mutations to their default values or initialization expressions are unobservable.

**3. `??` vs `||` on always-undefined values**

Several patterns use `value ?? fallback` where `value` is structurally guaranteed to be `undefined` (never `null`, `0`, `''`, or `false`). Stryker mutates `??` to `||`, which is semantically identical when the left operand is always `undefined`.

**4. Defensive guards on well-formed input**

Some mutators contain `if (!token)` guards as safety nets. Because all call sites pass non-null tokens (enforced by the ANTLR grammar and TypeScript types), the false branch is never executed. Mutations to these guards survive because no test can reach the guarded branch. A related shape appears in the ports layer, on a new file, but is **not** a survivor: `OrgMutationTestBed`'s `requireOriginal()` throws when `evaluate`/`restore` runs before `prepare` — unreachable by construction, since the service always calls `prepare` first (§ [Execution Ports](#execution-ports)). Both the guard's condition and its message are pinned: a unit test calls `restore` on a fresh bed and asserts the rejection *with a message matcher*, so the `StringLiteral` mutant on the diagnostic text is killed too. It is recorded here only because the baseline run above predates that matcher and still counts it among the survivors.

**5. Identity-preserving operator swaps in unreachable contexts**

A small number of arithmetic and logical mutations swap operators in expressions whose values are constrained to a single outcome by the enclosing logic (e.g., a constant that is always zero after a previous null guard). These are semantically equivalent to the original regardless of the operator used.

**6. Port capabilities declared ahead of their consumer**

An earlier draft of this refactor declared `MutationTestBed.concurrency` and an
`AsyncDisposable` teardown contract ahead of the second engine that was expected to need them.
That engine proved unnecessary (see [Execution Ports](#execution-ports)) and both members were
removed, so neither appears in the current scope. The finding worth keeping: Stryker generated
**no mutant at all** for either — a bare numeric-literal property initializer is outside every
mutator in the default catalog, and an intentionally empty method body is skipped by the
`BlockStatement` mutator. A capability declared without a consumer is therefore invisible to
mutation testing in both directions: it cannot be killed, and it cannot survive.

`src/commands/**` stays deliberately outside the scope: it holds only the oclif command
shell, whose wiring the NUT suite covers end to end rather than per mutant.

---

## Adding a New Mutator

1. Create a class extending `BaseListener` in `src/mutator/`
2. Implement the relevant `enter*` ANTLR hooks
3. Call `createMutationFromParserRuleContext(ctx, replacement)` or `createMutationFromTerminalNode(node, replacement)` to register mutations
4. Add a `MUTATOR_NAME` entry and a `MUTATOR_REGISTRY` entry in `MutantGenerator` (name + factory function)
5. The Proxy-based `MutationListener` automatically dispatches to the new mutator — no changes needed in the aggregation layer
6. The new mutator is automatically available for include/exclude filtering by its registry name

For type-aware mutators, accept `TypeRegistry` in the constructor and use `typeRegistry.resolveType()` to make type-informed decisions.

---

## Configuration

### Config File

Optional JSON file at `.mutation-testing.json` (or custom path via `--config-file`):

```json
{
  "mutators": {
    "include": ["ArithmeticOperator", "BoundaryCondition"]
  },
  "testMethods": {
    "exclude": ["testSlowIntegration"]
  },
  "threshold": 80,
  "skipPatterns": ["System\\.debug", "LoggingUtils\\."],
  "lines": ["10-50", "100-120"]
}
```

### CLI Flags

| Flag | Type | Description |
| --- | --- | --- |
| `--include-mutators` | string[] | Mutator names to include (exclusive with exclude) |
| `--exclude-mutators` | string[] | Mutator names to exclude (exclusive with include) |
| `--include-test-methods` | string[] | Test method names to include — bare `methodName` or qualified `ClassName.methodName` (exclusive with exclude) |
| `--exclude-test-methods` | string[] | Test method names to exclude — bare `methodName` or qualified `ClassName.methodName` (exclusive with include) |
| `--threshold` | integer | Minimum mutation score (0-100) for success |
| `--skip-patterns` | string[] | RE2 regex patterns — lines matching any pattern are excluded from mutation |
| `--lines` | string[] | Line ranges (e.g., `10-50`, `100`) — only mutate lines within these ranges |
| `--config-file` | file | Path to config file (must exist) |

### Merge Precedence

```text
CLI flags > config file > defaults (all mutators, all tests, no threshold)
```

`ConfigReader.resolve()` merges config file values with CLI flag overrides using `??` (CLI wins when present). Include/exclude pairs are mutually exclusive — enforced by oclif `exclusive` flag attribute. `skipPatterns` and `lines` follow the same merge precedence: CLI flags override config file values.

### Class Name Validation

Every Apex class name — the `-c` class under mutation and every `-t` perimeter class — must
match `/^[A-Za-z][A-Za-z0-9_]*$/` before any file or org I/O. `ApexClassRepository.read()`
reaches the Tooling API through jsforce's `.find()`, whose string-literal builder escapes
single quotes but leaves backslashes raw: a name ending in a backslash escapes its own
closing quote, so the literal runs on into the rest of the `WHERE` clause and the org
answers `MALFORMED_QUERY`. Constraining the name to the Apex identifier grammar keeps every
such character out of the query text, and covers every `read()` call site at once
rather than one.

Suite names are deliberately excluded from this rule: they name a different field
(`ApexTestSuite.TestSuiteName`), reach the org through `ApexTestSuiteRepository`, which
builds raw SOQL with correct escaping (backslash before quote — the order is load-bearing),
and their permitted character set is not the class identifier grammar.

### Mutator Registry

`MutantGenerator` maintains a `MUTATOR_REGISTRY` array mapping `MutatorName` constants to factory functions. `filterRegistry()` unifies include/exclude into a single code path: build a `Set<string>` of normalized names, then `MUTATOR_REGISTRY.filter(entry => isInclude ? match : !match)`. Case-insensitive matching. Unknown names trigger a warning. All mutators excluded → error.

---

## Pertinent Mutant Detection

Two additional filters allow users to focus mutation testing on the most relevant code regions, reducing noise from boilerplate, logging, or irrelevant lines.

### Skip Patterns (`--skip-patterns` / `skipPatterns`)

Exclude source lines matching RE2 regex patterns from mutation. Lines whose source text matches any pattern are skipped entirely — no mutations are generated for them.

```shell
--skip-patterns "System\.debug" "LoggingUtils\."
```

Typical use cases: skip logging statements, debug output, or generated boilerplate.

### Line Ranges (`--lines` / `lines`)

Restrict mutations to specific line ranges. Only lines within the specified ranges are eligible for mutation.

```shell
--lines 10-50 100-120
```

Useful for focusing on a specific method or recently changed code.

### `isLineEligible()` — Unified Line Filter

`MutationListener.isLineEligible(line)` encapsulates all line-level eligibility checks at the Proxy level, replacing the previous `coveredLines.has()` check. All filters are **intersected** — a line must pass every active filter to be eligible:

```text
isLineEligible(line)
    │
    ├─ line is falsy?                              → false
    │
    ├─ coveredLines.has(line)?                     → false if not covered
    │     (always active — baseline coverage)
    │
    ├─ allowedLines defined AND                    → false if outside range
    │  !allowedLines.has(line)?
    │     (active only when --lines provided)
    │
    ├─ skipPatterns.length > 0 AND                 → false if any pattern matches
    │  sourceLines[line-1] matches any pattern?
    │     (active only when --skip-patterns provided)
    │
    └─ otherwise                                   → true (eligible)
```

When `--lines` is not provided, `allowedLines` is `undefined` (no range filter). When `--skip-patterns` is not provided, `skipPatterns` is an empty array (no pattern filter). This means the default behavior (no flags) is identical to the previous `coveredLines.has()` check.

### re2js for Regex Safety

Skip patterns use [re2js](https://github.com/le0pard/re2js) — a pure-JS port of Google's RE2/J
— instead of JavaScript's built-in `RegExp`. re2js accepts RE2 syntax and guarantees
**linear-time** matching, preventing ReDoS (Regular Expression Denial of Service) attacks from
malicious or poorly written patterns, with zero native code and zero install scripts. Pattern
compilation is validated at configuration time — invalid patterns fail fast with a descriptive
error.

`src/service/skipPattern.ts` defines the port the rest of the codebase depends on, so the regex engine stays out of `mutationListener.ts`, `mutantGenerator.ts`, and `mutationTestingService.ts`:

```typescript
interface SkipPattern {
  test(line: string): boolean
}

compileSkipPattern(pattern: string): SkipPattern
```

`compileSkipPattern` is the re2js-backed adapter: it compiles the pattern and returns a
`SkipPattern` whose `test()` matches via RE2JS's unanchored substring `test()` on the DFA path.
Compilation throws the raw engine error — the port stays domain-agnostic and leaves user-facing
wrapping to the caller. `ConfigReader.compileSkipPatterns` catches that error and wraps it as
`Invalid skip pattern '<p>': <reason>`.

### Data Flow

```text
CLI flags / config file
    │
    ▼
ConfigReader.resolve()
    └─ validate lines (format + start ≤ end)
    │
    ▼
MutationTestingService constructor
    ├─ ConfigReader.compileSkipPatterns(skipPatterns)
    │     → string[] → SkipPattern[] (validates RE2 compilation)
    └─ ConfigReader.parseLineRanges(lines)
    │     → string[] (e.g. ["10-50","100-120"]) → Set<number> (expanded)
    │
    ▼
MutantGenerator.compute(..., skipPatterns, allowedLines)
    │
    ▼
MutationListener(mutators, coveredLines, skipPatterns, allowedLines, sourceLines)
    │
    ▼
Proxy → isLineEligible(line) gates every enter*/exit* dispatch
```

---

## InlineConstantMutator — Handler Strategy

`InlineConstantMutator` uses a **Handler Strategy pattern** to dispatch literal mutations. A `Map<LiteralDetector, LiteralHandler>` pairs ANTLR terminal node detectors with type-specific handlers:

```text
enterLiteral(ctx)
    │
    ├─ ctx.IntegerLiteral()? ──► IntegerLiteralHandler   [0, 1, -1, v+1, v-1]
    ├─ ctx.LongLiteral()?    ──► LongLiteralHandler      [0L, 1L, -1L, v+1L, v-1L]
    ├─ ctx.NumberLiteral()?   ──► NumberLiteralHandler    [0.0, 1.0, -1.0, v+1.0, v-1.0]
    ├─ ctx.StringLiteral()?   ──► StringLiteralHandler    '' (skip if already empty)
    ├─ ctx.BooleanLiteral()?  ──► BooleanLiteralHandler   true ↔ false
    └─ ctx.NULL()?            ──► NullLiteralHandler      type-appropriate default
```

**CRCR strategy** (Constant Replacement with Constant Replacement — PIT nomenclature): For numeric types, candidates `[0, 1, -1, value+1, value-1]` are deduplicated via `Set` and filtered to exclude the original value. This ensures boundary-sensitive mutations without generating identity replacements.

### Null Literal Resolution

`NullLiteralHandler` walks up the AST to determine what type the `null` literal inhabits:

```text
null literal
    │
    ├─ in ReturnStatement? ──► resolve enclosing method return type via TypeRegistry
    │
    └─ in LocalVariableDeclaration / FieldDeclaration?
       └─ ctx.typeRef().text ──► classifyApexType() ──► getDefaultValueForApexType()
```

`typeRef()` is used instead of `children[0]` to handle modifiers like `final` that shift child indices.

### Expression Type Classification (`astUtils.resolveExpressionApexType`)

Numeric literal classification follows Apex language rules:

```text
text starts with digit?
    ├─ ends with L/l?      ──► LONG
    ├─ contains '.'?       ──► DOUBLE
    └─ otherwise           ──► INTEGER
```

This enables `ArgumentPropagationMutator` to correctly match numeric arguments to method parameter types.

---

## Further Improvements Not Implemented

This section documents approaches that were considered for reducing equivalent mutants but deliberately not implemented, and explains why.

### SMT-Based Equivalence Detection

**What it is**: Using a Satisfiability Modulo Theories (SMT) solver (e.g., Z3, MEDIC) to statically prove that a mutated expression is semantically equivalent to the original — for example, proving `a + 0 ≡ a` in all models.

**Why not implemented**:

1. **Apex platform coupling**: The vast majority of Apex code touches Salesforce platform types (`SObject`, `Limits`, `Database`, `SOQL results`) whose semantics are not modelled by standard SMT theories. Encoding these would require a custom Salesforce theory layer, which is a major research project in its own right.

2. **Small pure-expression subset**: SMT is only tractable for closed, pure arithmetic/boolean expressions. In practice, almost every non-trivial Apex mutation involves method calls or platform-dependent state, putting it outside the scope where SMT provides value.

3. **Engineering cost vs. impact**: Integrating a JVM or native SMT solver into a Node.js Salesforce CLI plugin adds non-trivial dependency weight, increases build complexity, and introduces solver timeout risks — all for a payoff limited to a small fraction of mutations (integer arithmetic with literal operands).

4. **Static identity guards already cover the easy cases**: The guards documented in [Equivalent Mutant Avoidance](#equivalent-mutant-avoidance) — `isLiteralZero`, `isLiteralOne`, `isIdentityOperand`, and the post-op-in-return context checks — eliminate the most common SMT-detectable equivalences with zero added complexity.

**Alternative explored**: Lightweight symbolic analysis for constant-folding cases (e.g., `0 + 0`, `1 * 1`) — assessed as having negligible real-world frequency and therefore not worth the implementation effort.

---

### Mutant Subsumption

**What it is**: Post-hoc filtering that removes a mutation from the result set when another mutation already "subsumes" it — i.e., any test that kills mutation B also kills mutation A, so A is redundant. Example: if `a > b → false` subsumes `a > b → a != b`, the latter can be removed.

**Why not implemented**:

1. **Wrong cost model for Apex**: Each mutant requires a full Salesforce org deployment + Apex test execution cycle (seconds to minutes per mutant). Subsumption filtering happens *after* generating the mutant set, so it does not reduce deployment cost — it only reduces the number of entries in the report. The bottleneck is org round-trips, not report size.

2. **Requires running tests first**: Subsumption analysis needs test execution results to determine which tests kill which mutants. This makes it a post-processing concern that would require significant orchestration changes (retain per-test kill sets, compare across all mutants). The benefit — a cleaner report — does not justify this overhead.

3. **Correct approach is pre-generation filtering**: The effective way to reduce redundancy in this codebase is to *not generate* equivalent or dominated mutations in the first place (via identity guards, type-aware checks, and context guards). This is the approach taken throughout the mutators.

4. **Static subsumption is undecidable in general**: Dynamic subsumption requires test execution. Static subsumption (proving at parse time that mutation B is dominated by A) is only decidable for specific patterns and overlaps heavily with the SMT-based approach, which is already ruled out above.
