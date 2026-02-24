# Design Document

## Overview

Salesforce CLI plugin implementing **mutation testing** for Apex code. It evaluates test suite quality by introducing intentional code mutations into a deployed Apex class, running the associated tests against each mutation, and reporting which mutants were **killed** (detected) versus **survived** (undetected).

```
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg>
sf apex mutation test run -c <ApexClass> -t <TestClass> -o <TargetOrg> --dry-run
```

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│              commands/apex/mutation/test/run.ts           │
│           (CLI flags, progress UI, score output)         │
├──────────────────────────────────────────────────────────┤
│                   Orchestration Layer                     │
│            service/mutationTestingService.ts              │
│     (workflow coordination, error classification,        │
│      score calculation, result assembly)                  │
├──────────────────────────────────────────────────────────┤
│                      Domain Layer                         │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │  Mutation Engine     │  │     Type System            │ │
│  │  mutantGenerator.ts  │  │  typeDiscoverer.ts         │ │
│  │  mutationListener.ts │  │  typeMatcher.ts            │ │
│  │  baseListener.ts     │  │  TypeRegistry.ts           │ │
│  │  astUtils.ts         │  │  ApexMethod.ts             │ │
│  │  [25 mutators]       │  │                            │ │
│  └─────────────────────┘  └────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                    │
│  ┌───────────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │ApexClassRepository│ │ApexTestRunner│ │SObjectDescribe│ │
│  │  (Tooling API)    │ │ (apex-node) │ │  Repository   │ │
│  └───────────────────┘ └─────────────┘ └──────────────┘ │
├──────────────────────────────────────────────────────────┤
│                    Reporting Layer                        │
│  ┌───────────────────────┐  ┌──────────────────────────┐ │
│  │  HTMLReporter.ts       │  │  DryRunReporter.ts       │ │
│  │ (Stryker schema,      │  │ (per-mutator counts,     │ │
│  │  mutation-test-        │  │  dry-run summary stats)  │ │
│  │  elements)             │  │                          │ │
│  └───────────────────────┘  └──────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Mutation Testing Lifecycle

```
sf apex mutation test run -c MyClass -t MyClassTest -o myOrg
│
├─ 1. VALIDATE
│     ApexClassValidator
│       ├─ read(MyClass)     → exists?
│       └─ read(MyClassTest) → exists + @IsTest?
│
├─ 2. FETCH SOURCE
│     ApexClassRepository.read(MyClass) → { Id, Body }
│
├─ 3. DISCOVER DEPENDENCIES
│     ApexClassRepository.getApexClassDependencies(Id)
│       → MetadataComponentDependency[]
│       → partition into: ApexClass | StandardEntity | CustomObject
│
├─ 4. BUILD TYPE SYSTEM
│     SObjectDescribeRepository.describe(sObjectTypes)
│       → parallel Describe API calls (max 25 concurrent)
│     TypeDiscoverer.analyze(Body)
│       → ANTLR parse #1 → TypeRegistry
│         (methodTypeTable, variableScopes, classFields)
│
├─ 5. BASELINE TEST RUN
│     ApexTestRunner.getTestMethodsPerLines(MyClassTest)
│       → runTestAsynchronous (with code coverage)
│       → testMethodsPerLine: Map<line, Set<testMethodName>>
│       → coveredLines: Set<line>
│       ✓ All tests must pass (green baseline)
│
├─ 6. GENERATE MUTATIONS
│     MutantGenerator.compute(Body, coveredLines, typeRegistry)
│       → ANTLR parse #2 → AST
│       → ParseTreeWalker fires enter*/exit* on 25 mutators
│         (filtered by coveredLines via Proxy)
│       → ApexMutation[] (with token ranges)
│
│     ── DRY-RUN EXIT POINT ──────────────────────────
│     If --dry-run: return DryRunMutant[] (line,
│       mutatorName, original, replacement) and stop.
│       No deployment, no test execution, no rollback.
│       Command displays table + per-mutator summary
│       via DryRunReporter.countByMutator().
│     ────────────────────────────────────────────────
│
├─ 7. MUTATION TESTING LOOP (for each mutation)
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
│     └─────────────────────────────────────────────┘
│
├─ 8. ROLLBACK
│     ApexClassRepository.update(originalBody)
│
├─ 9. REPORT
│     HTMLReporter → Stryker JSON schema → HTML with
│     mutation-test-elements web component
│
└─ 10. SCORE
│     score = killed / (total - compileErrors) × 100
```

---

## Core Design Patterns

### Proxy-Based Listener Aggregation

The central architectural pattern. `MutationListener` uses a JavaScript `Proxy` to dynamically dispatch ANTLR parse tree callbacks to all 25 registered mutators without explicit delegation.

```
                        ┌──────────────────────┐
  ParseTreeWalker       │   MutationListener   │
  ─── enter*(ctx) ────► │      (Proxy)         │
                        │                      │
                        │  1. Check coveredLines│
                        │     .has(ctx.start    │
                        │          .line)       │
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
- **Coverage filtering** happens once at the Proxy level: `coveredLines.has(ctx.start.line)` gates dispatch

Coverage filtering is applied uniformly to all mutators — no exceptions.

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

```
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
|---|---|---|
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

```
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
|---|---|---|
| No expression | `resolveType('calculate')` | Method return type lookup |
| With `(` | `resolveType('m', 'getTotal()')` | Strip `()`, lookup method return type |
| With `.` | `resolveType('m', 'acc.Name')` | Resolve root variable, then field via matcher |
| Plain name | `resolveType('m', 'rate')` | Method scope → class fields → classify |

Variable resolution priority: **method-local scope > class fields** (shadowing).

### Type Classification

`classifyApexType()` maps type names to `ApexType` enum values:

```
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

```
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

### 25 Mutation Operators by Category

```
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
│  RemoveIncrementsMutator     i++ → i                             │
│  ArithmeticOperatorDeletion  a + b → a  or  a + b → b           │
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
│  UnaryOperatorInsertionMutator  x → -x  (in expressions)        │
└──────────────────────────────────────────────────────────────────┘
```

### Type-Awareness Requirements

| Mutator | Needs TypeRegistry | Reason |
|---|---|---|
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
| InlineConstantMutator | Yes | Null literal replacement depends on declared/return type |

---

## Deployment Mechanism

Each mutation is deployed using the Tooling API **MetadataContainer** pattern:

```
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

```
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

```
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

```
ApexMutationTestResult
    │
    ├─ transformApexResults()
    │   ├─ language: 'java' (Apex ≈ Java for highlighting)
    │   ├─ source: original Apex source
    │   └─ mutants[]:
    │       ├─ id, mutatorName, replacement
    │       ├─ status: Killed|Survived|NoCoverage|CompileError|RuntimeError
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

```
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
              │                    │
              │  DryRunReporter    │
              │  → countByMutator  │
              │  → summary stats   │
              └────────────────────┘
```

---

## Testing Strategy

Four test tiers with distinct scopes and runners:

```
┌────────────────────────────────────────────────────────────┐
│  E2E Tests (shell scripts, real org, post-publish)         │
│  npm run test:e2e                                          │
│  setup → execute command → git diff snapshot → teardown    │
├────────────────────────────────────────────────────────────┤
│  NUT Tests (Jest + experimental ESM, mocked Connection)    │
│  jest --config jest.config.nut.js                          │
│  SfCommand.run() with mocked org, validators, services     │
├────────────────────────────────────────────────────────────┤
│  Integration Tests (Jest, real ANTLR parsing)              │
│  test/integration/*.integration.test.ts                    │
│  Source → parse → mutate → verify mutations                │
├────────────────────────────────────────────────────────────┤
│  Unit Tests (Jest, 100% coverage threshold)                │
│  test/unit/**/*.test.ts                                    │
│  Isolated class/function tests with mocked dependencies    │
└────────────────────────────────────────────────────────────┘
```

| Tier | Runner | Config | Org Required | Speed | Scope |
|---|---|---|---|---|---|
| Unit | Jest | `jest.config.js` | No | ~8s | Class-level isolation |
| Integration | Jest | `jest.config.js` | No | Included in unit run | ANTLR parse + mutate |
| NUT | Jest (ESM) | `jest.config.nut.js` | No (mocked) | ~1.5s | Command-level with mocked org |
| E2E | npm scripts | N/A | Yes | Minutes | Full plugin command against real org |

**NUT tests** use `--experimental-vm-modules` for native ESM support, enabling `jest.unstable_mockModule()` with dynamic imports to mock `@salesforce/core` and `@salesforce/sf-plugins-core` at the module level.

**E2E tests** run the published plugin command via `sf apex mutation test run`, validate output via `git diff --quiet` against a committed snapshot, and always execute teardown (class redeployment) even on failure.

**Test fixtures** (`test/classes/Mutation.cls` and `MutationTest.cls`) are shared across NUT and E2E tiers. `Mutation.cls` contains constructs triggering all 25 mutators. `MutationTest.cls` provides 100% line coverage.

---

## Adding a New Mutator

1. Create a class extending `BaseListener` in `src/mutator/`
2. Implement the relevant `enter*` ANTLR hooks
3. Call `createMutationFromParserRuleContext(ctx, replacement)` or `createMutationFromTerminalNode(node, replacement)` to register mutations
4. Add the mutator to the array in `MutantGenerator.compute()` (inside `getMutators()` equivalent section)
5. The Proxy-based `MutationListener` automatically dispatches to the new mutator — no changes needed in the aggregation layer

For type-aware mutators, accept `TypeRegistry` in the constructor and use `typeRegistry.resolveType()` to make type-informed decisions.

---

## InlineConstantMutator — Handler Strategy

`InlineConstantMutator` uses a **Handler Strategy pattern** to dispatch literal mutations. A `Map<LiteralDetector, LiteralHandler>` pairs ANTLR terminal node detectors with type-specific handlers:

```
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

```
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

```
text starts with digit?
    ├─ ends with L/l?      ──► LONG
    ├─ contains '.'?       ──► DOUBLE
    └─ otherwise           ──► INTEGER
```

This enables `ArgumentPropagationMutator` to correctly match numeric arguments to method parameter types.
