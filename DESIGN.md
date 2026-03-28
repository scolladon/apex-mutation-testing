# Design Document

## Overview

Salesforce CLI plugin implementing **mutation testing** for Apex code. It evaluates test suite quality by introducing intentional code mutations into a deployed Apex class, running the associated tests against each mutation, and reporting which mutants were **killed** (detected) versus **survived** (undetected).

```shell
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg>
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --dry-run
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --include-mutators ArithmeticOperator --threshold 80
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --skip-patterns "System\\.debug" --lines 10-50 100-120
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --config-file .mutation-testing.json
```

---

## Architecture Layers

```text
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│              commands/apex/mutation/test/run.ts           │
│           (CLI flags, progress UI, score output,         │
│            config resolution, threshold gating)          │
├──────────────────────────────────────────────────────────┤
│                  Configuration Layer                      │
│              service/configReader.ts                      │
│     (JSON config file + CLI flag merging)                │
├──────────────────────────────────────────────────────────┤
│                   Orchestration Layer                     │
│            service/mutationTestingService.ts              │
│     (workflow coordination via named sub-methods,        │
│      error classification, score calculation,            │
│      result assembly)                                    │
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
│                   Infrastructure Layer                    │
│  ┌───────────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │ApexClassRepository│ │ApexTestRunner│ │SObjectDescribe│ │
│  │  (Tooling API)    │ │ (apex-node) │ │  Repository   │ │
│  └───────────────────┘ └─────────────┘ └──────────────┘ │
├──────────────────────────────────────────────────────────┤
│                    Reporting Layer                        │
│  ┌───────────────────────────────────────────────────────┐│
│  │  HTMLReporter.ts                                      ││
│  │ (Stryker schema, mutation-test-elements,              ││
│  │  used for both normal and dry-run paths)              ││
│  └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## Mutation Testing Lifecycle

```text
sf apex mutation test run -c MyClass -t MyClassTest -o myOrg
│
├─ 1. RESOLVE CONFIGURATION
│     ConfigReader.resolve(cliFlags)
│       ├─ read .mutation-testing.json (if exists)
│       ├─ merge: CLI flags override config file
│       ├─ validate: threshold 0-100
│       └─ validate: lines format (N or N-M, start ≤ end)
│     Precedence: CLI flags > config file > defaults
│
├─ 2. VALIDATE
│     ApexClassValidator
│       ├─ read(MyClass)     → exists?
│       └─ read(MyClassTest) → exists + @IsTest?
│
├─ 3. FETCH SOURCE
│     ApexClassRepository.read(MyClass) → { Id, Body }
│
├─ 4. DISCOVER DEPENDENCIES
│     ApexClassRepository.getApexClassDependencies(Id)
│       → MetadataComponentDependency[]
│       → partition into: ApexClass | StandardEntity | CustomObject
│
├─ 5. BUILD TYPE SYSTEM
│     SObjectDescribeRepository.describe(sObjectTypes)
│       → parallel Describe API calls (max 25 concurrent)
│     TypeDiscoverer.analyze(Body)
│       → ANTLR parse #1 → TypeRegistry
│         (methodTypeTable, variableScopes, classFields)
│
├─ 6. COMPILABILITY VERIFICATION
│     Deploy main class back to org via
│       ApexClassRepository.update(apexClass)
│       → wrapped in timeExecution() → deployTime
│       → validates class compiles (catches broken deps)
│       → on failure: throw with Salesforce error details
│     Fetch + deploy test class back to org
│       → validates test class compiles
│       → on failure: throw with Salesforce error details
│     Rationale: Salesforce only checks compilation of
│       the deployed element, not its dependents. A class
│       can be broken if a dependency changed after last
│       deploy. Without this check, all mutants would get
│       CompileError → misleading 100% score.
│
├─ 7. BASELINE TEST RUN
│     ApexTestRunner.getTestMethodsPerLines(MyClassTest)
│       → wrapped in timeExecution() → testTime
│       → runTestAsynchronous (with code coverage)
│       → testMethodsPerLine: Map<line, Set<testMethodName>>
│       ✓ All tests must pass (green baseline)
│
├─ 7b. FILTER TEST METHODS (if configured)
│     buildTestMethodFilter() → predicate (or undefined)
│     filterTestMethods(testMethodsPerLine, predicate)
│       → filter testMethodsPerLine in-place
│       → lines with zero remaining methods are deleted
│       → coveredLines derived after filtering
│     Rationale: filtering early reduces both the number
│       of mutations generated AND test executions per mutant.
│
├─ 8. GENERATE MUTATIONS
│     MutantGenerator.compute(Body, coveredLines, typeRegistry,
│       mutatorFilter, skipPatterns, allowedLines)
│       → ANTLR parse #2 → AST
│       → filter mutator registry by include/exclude
│         (case-insensitive name matching)
│       → ParseTreeWalker fires enter*/exit* on filtered mutators
│         (filtered by isLineEligible() via Proxy —
│          intersects coverage, line ranges, skip patterns)
│       → ApexMutation[] (with token ranges)
│
├─ 9. TIME ESTIMATION
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
├─ 10. MUTATION TESTING LOOP (for each mutation)
│     ┌─────────────────────────────────────────────┐
│     │ a. MutantGenerator.mutate(mutation)          │
│     │    → TokenStreamRewriter → mutated source    │
│     │                                              │
│     │ b. ApexClassRepository.update(mutatedSource) │
│     │    → MetadataContainer deploy + poll         │
│     │                                              │
│     │ c. ApexTestRunner.runTestMethods(            │
│     │      testClass, testsForMutatedLine)         │
│     │    → only tests covering the mutated line    │
│     │                                              │
│     │ d. Classify outcome:                         │
│     │    Tests failed  → Killed                    │
│     │    Tests passed  → Survived                  │
│     │    Deploy failed → CompileError              │
│     │    Limit error   → Killed                    │
│     │    Other error   → RuntimeError              │
│     │                                              │
│     │ e. Update progress bar with remaining time   │
│     │    rolling avg = elapsed / completed         │
│     │    remaining = avg × (total - completed)     │
│     │    "Remaining: ~Xm Ys | <result>"            │
│     └─────────────────────────────────────────────┘
│
├─ 11. ROLLBACK
│      ApexClassRepository.update(originalBody)
│
├─ 12. REPORT
│      HTMLReporter → Stryker JSON schema → HTML with
│      mutation-test-elements web component
│
├─ 13. SCORE
│      score = killed / (total - compileErrors) × 100
│
└─ 14. THRESHOLD GATING (if configured)
│      If score < threshold → throw SfError (exit code 1)
│      Message: "Mutation score X% is below threshold Y%"
│      Skipped in dry-run mode (no score computed)
```

### `process()` Method Decomposition

The `process()` method is a thin orchestrator (~40 lines) that delegates each lifecycle step to a named private method:

```text
process()
├── createAdapters()            → step 2 (adapters)
├── fetchApexClass()            → step 3
├── discoverTypes()             → steps 4-5
├── verifyCompilation()         → step 6 (main class)
├── verifyTestClassCompilation()→ step 6 (test class)
├── runBaselineTests()          → step 7
├── extractCoveredLines()       → step 7b (filtering + coverage)
├── generateMutations()         → step 8
├── displayTimeEstimate()       → step 9
├── buildDryRunResult()         → dry-run exit point
├── executeMutationLoop()       → step 10
│   └── evaluateMutation()      → single mutation: deploy + test + classify
└── rollback()                  → step 11
```

Each method encapsulates one logical concern. `evaluateMutation()` handles the try/catch error classification for a single mutation. `formatRemainingTime()` extracts the time estimation math from the progress update.

---

## Core Design Patterns

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

### Strategy Pattern — Error Classification

`MutationTestingService` uses an array of error strategies to classify thrown exceptions during mutation deployment/testing:

```typescript
errorStrategies = [
  { matches: msg => msg.includes('Deployment failed:'),  classify: () => 'CompileError'  },
  { matches: msg => msg.includes('LIMIT_USAGE_FOR_NS'),  classify: () => 'Killed'        },
  { matches: () => true,                                  classify: () => 'RuntimeError'  },
]
```

The first strategy whose `matches()` returns `true` wins (`Array.find`). This makes adding new error categories a single-line change.

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

All Salesforce org interactions are isolated behind repository interfaces:

| Repository | API | Purpose |
| --- | --- | --- |
| `ApexClassRepository` | Tooling API | CRUD on ApexClass, MetadataContainer deployment |
| `ApexTestRunner` | @salesforce/apex-node | Test execution with/without coverage |
| `SObjectDescribeRepository` | Metadata API describe | SObject field type resolution |

### Builder/Fluent API — TypeDiscoverer

```typescript
new TypeDiscoverer()
  .withMatcher(apexClassMatcher)
  .withMatcher(sObjectMatcher)
  .analyze(code)
```

### Shared Mutable State

The `_mutations` array is shared by reference across all listeners. This is safe because ANTLR tree walking is **synchronous** — no concurrent writes.

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

`TypeRegistry.resolveType()` handles four expression forms:

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

Each mutation is deployed using the Tooling API **MetadataContainer** pattern:

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
│                      │  IsRunTests: true
└──────────┬──────────┘
           │
           ▼
     ┌───────────┐     poll every 100ms
     │  Polling   │◄────────────────────┐
     │  Loop      │                     │
     └─────┬─────┘                      │
           │                            │
     ┌─────▼─────┐    No    ┌──────────┴─┐
     │ Terminal   ├─────────►│  Retrieve  │
     │ State?     │          │  + wait    │
     └─────┬─────┘          └────────────┘
           │ Yes
           ▼
  Completed | Failed | Error | Aborted
```

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

A key performance optimization: only the test methods that **cover the mutated line** are executed per mutation.

```text
Baseline Test Run (with coverage)
    │
    ▼
testMethodsPerLine: Map<line, Set<testMethodName>>
    │
    │  Line 10 → { testA, testB }
    │  Line 15 → { testA }
    │  Line 20 → { testB, testC }
    │
    ▼
Mutation on Line 15:
    → only run testA (not testB, testC)

Mutation on Line 20:
    → only run testB, testC (not testA)
```

This dramatically reduces the number of test executions per mutation cycle.

---

## HTML Report Generation

The reporter transforms internal results to the [Stryker Mutation Testing Report Schema v2](https://github.com/stryker-mutator/mutation-testing-elements):

```text
ApexMutationTestResult
    │
    ├─ transformApexResults()
    │   ├─ language: 'java' (Apex ≈ Java for highlighting)
    │   ├─ source: original Apex source
    │   └─ mutants[]:
    │       ├─ id, mutatorName, replacement
    │       ├─ status: Killed|Survived|NoCoverage|CompileError|RuntimeError|Pending
    │       └─ location: { start: {line,column}, end: {line,column} }
    │
    ├─ escapeHtmlTags() → prevent injection in <script>
    │
    └─ HTML template with:
        <script src="mutation-testing-elements@3.5.1">
        <mutation-test-report-app>
        <script>document.querySelector(...).report = {json}</script>
```

---

## Data Flow Summary

```text
                  Salesforce Org
                 ┌──────────────┐
                 │  ApexClass   │◄──── read / update (deploy mutant / rollback)
                 │  TestService │◄──── runTestAsynchronous (baseline + per-mutant)
                 │  Describe    │◄──── SObject field metadata
                 └──────┬───────┘
                        │
              ┌─────────▼──────────┐
              │   Adapter Layer    │
              │ Repository + Runner│
              └─────────┬──────────┘
                        │
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

**Test fixtures** (`test/classes/Mutation.cls` and `MutationTest.cls`) are shared across NUT and E2E tiers. `Mutation.cls` contains constructs triggering all 25 mutators. `MutationTest.cls` provides 100% line coverage.

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
| `--include-test-methods` | string[] | Test method names to include (exclusive with exclude) |
| `--exclude-test-methods` | string[] | Test method names to exclude (exclusive with include) |
| `--threshold` | integer | Minimum mutation score (0-100) for success |
| `--skip-patterns` | string[] | RE2 regex patterns — lines matching any pattern are excluded from mutation |
| `--lines` | string[] | Line ranges (e.g., `10-50`, `100`) — only mutate lines within these ranges |
| `--config-file` | file | Path to config file (must exist) |

### Merge Precedence

```text
CLI flags > config file > defaults (all mutators, all tests, no threshold)
```

`ConfigReader.resolve()` merges config file values with CLI flag overrides using `??` (CLI wins when present). Include/exclude pairs are mutually exclusive — enforced by oclif `exclusive` flag attribute. `skipPatterns` and `lines` follow the same merge precedence: CLI flags override config file values.

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

### RE2 for Regex Safety

Skip patterns use [RE2](https://github.com/google/re2) (via the `re2` npm package) instead of JavaScript's built-in `RegExp`. RE2 guarantees **linear-time** matching, preventing ReDoS (Regular Expression Denial of Service) attacks from malicious or poorly written patterns. Pattern compilation is validated at configuration time — invalid RE2 patterns fail fast with a descriptive error.

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
    │     → string[] → RE2Instance[] (validates RE2 compilation)
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

**What it is**: Using a Satisfiability-Modulo-Theories (SMT) solver (e.g., Z3, MEDIC) to statically prove that a mutated expression is semantically equivalent to the original — for example, proving `a + 0 ≡ a` in all models.

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
