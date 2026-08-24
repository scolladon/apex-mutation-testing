# summary

Evaluate test coverage quality by injecting mutations and measuring test detection rates

# description

The Apex Mutation Testing plugin helps evaluate the effectiveness of your Apex test classes by introducing mutations into your code and checking if your tests can detect these changes:

The plugin provides insights into how trustworthy your test suite is by measuring its ability to catch intentional code changes.

# flags.apex-class.summary

Apex class name to mutate. A bare name reaches only the namespace that owns it; name a class from another namespace as `namespace.ClassName`.

# flags.test-class.summary

Apex test class name(s) to validate mutations. Repeat the flag or pass a comma-delimited list to cover a class with multiple test classes. A bare name reaches only the namespace that owns it; name a class from another namespace as `namespace.ClassName`.

# flags.test-suite.summary

Apex test suite name(s) whose classes define the mutation perimeter. Repeat the flag or pass a comma-delimited list. Suite names are case-sensitive.

# flags.report-dir.summary

Path to the directory where mutation test reports will be generated

# examples

- Run mutation testing on a class with its test file:

  <%= config.bin %> <%= command.id %> --apex-class MyClass --test-class MyClassTest

- Preview mutations without running them:

  <%= config.bin %> <%= command.id %> --apex-class MyClass --test-class MyClassTest --dry-run

- Run mutation testing on a class covered by multiple test classes:

  <%= config.bin %> <%= command.id %> --apex-class MyClass --test-class MyClassTest,MyClassTest2

- Run mutation testing on a class covered by an Apex test suite:

  <%= config.bin %> <%= command.id %> --apex-class MyClass --test-suite MyTestSuite

# info.reportGenerated

Report has been generated at this location: %s

# info.CommandIsRunning

Running mutation testing for "%s" with test class(es) "%s"

# info.DryRunCommandIsRunning

Running dry run mutation testing for "%s" with test class(es) "%s"

# info.CommandSuccess

Mutation score: %s%

# info.CommandFailure

Failure

# info.EncourageSponsorship

💡 Enjoying apex-mutation-testing?
Your contribution helps us provide fast support 🚀 and high quality features 🔥
Become a sponsor: https://github.com/sponsors/scolladon 💙

# error.noCoverage

No test coverage found for '%s'. Ensure '%s' tests exercise the code you want to mutation test.

# info.aggregatedCoverageOnly

Per-test coverage unavailable on this org due to "Store Only Aggregated Code Coverage" setting, using aggregate coverage instead - all tests will run per mutant (slower), and the mutation score may be understated because ApexCodeCoverageAggregate is a cumulative org-wide rollup, so lines covered only by other test classes produce mutants these test classes can never kill. Report attribution is also class-level, not method-level, in this mode: every test in the perimeter covers every mutant, so coveredBy and killedBy list every class that ran rather than the specific method responsible

# info.syncTransportFallback

Synchronous test execution is unavailable (%s). Falling back to the asynchronous transport.

# info.typeResolutionDegraded

Type resolution degraded for %s: these types could not be resolved against the org, so type-aware mutators fall back to untyped behaviour and some mutants are not generated%s.

# error.blankTestClass

Blank apex test class name found: '%s'. Remove empty entries from the -t/--test-class flag.

# error.invalidClassName

Invalid Apex class name: '%s'. An Apex class name starts with a letter and contains only letters, digits and underscores, optionally prefixed by a namespace and a dot (for example 'MyClass' or 'MyNamespace.MyClass').

# error.objectConventionClassName

Apex class name '%s' uses the object convention 'Namespace__Name'. Apex classes use the dotted convention instead: write 'Namespace.Name'.

# error.blankTestSuite

Blank apex test suite name found: '%s'. Remove empty entries from the --test-suite flag.

# error.testSuiteNotFound

Apex test suite '%s' not found. Apex test suite names are case-sensitive — check the exact spelling in Setup > Apex Test Suites.

# error.testSuiteEmpty

Apex test suite '%s' contains no Apex test classes. Add classes to it in Setup > Apex Test Suites, or remove it from the --test-suite flag.

# error.noMutations

No mutations could be generated for '%s'. %s line(s) covered but no mutable patterns found.

# error.noMutationsInLineRange

No mutations could be generated for '%s'. None of the %s covered line(s) fall within the requested --lines range (%s).

# error.noMutationsAfterSkipPatterns

No mutations could be generated for '%s'. All %s candidate line(s) were excluded by --skip-patterns.

# error.noMutationsForMutatorFilter

No mutations could be generated for '%s'. %s line(s) are eligible but no enabled mutator matched them. Widen --include-mutators or drop --exclude-mutators.

# flags.dry-run.summary

Preview mutations without deploying or running tests

# error.compilabilityCheckFailed

The Apex class '%s' does not compile on the target org. This can happen when a dependency was modified after the class was last deployed. Fix compilation errors before running mutation testing.\nError: %s

# info.timeEstimate

Estimated time: %s

# info.timeEstimateBreakdown

Deploy: %s/iteration | Test: %s/iteration | Mutants: %s | Groups: %s

# flags.include-mutators.summary

Mutator names to include (e.g. ArithmeticOperator, BoundaryCondition)

# flags.exclude-mutators.summary

Mutator names to exclude

# flags.include-test-methods.summary

Test method names to include. Bare `methodName` applies to that method in every test class in the perimeter; qualified `ClassName.methodName` applies to that one class only; `namespace.ClassName.methodName` names a class from another namespace. Matching ignores case.

# flags.exclude-test-methods.summary

Test method names to exclude. Bare `methodName` applies to that method in every test class in the perimeter; qualified `ClassName.methodName` applies to that one class only; `namespace.ClassName.methodName` names a class from another namespace. Matching ignores case.

# flags.threshold.summary

Minimum mutation score (0-100) required for the command to succeed

# flags.config-file.summary

Path to mutation testing configuration file

# flags.skip-patterns.summary

RE2 regex patterns to skip lines from mutation (e.g., System\.debug)

# flags.lines.summary

Line ranges to mutate (e.g., 1-10, 42). Only these lines are eligible for mutation.

# flags.mutation-grouping.summary

Group mutations whose covering tests are disjoint into a single deploy + test run. Reduces deployments and async test-run kickoffs at the cost of larger blast radius on compile errors. Runs the full pipeline: test-induced clique lower bound → DSATUR heuristic → exact backtracking coloring. Off by default.

# info.groupingPlan

Mutation grouping enabled — packed %s mutations into %s group(s) (%s%% fewer deployments, lower bound %s)%s

# info.groupingFallback

Group of %s mutations failed batch deploy — re-evaluating individually

# error.thresholdNotMet

Mutation score %s% is below the required threshold of %s%

# info.testClassNotUsable

Skipping test class '%s'%s: %s.

# info.contributedBySuite

(contributed by test suite %s)

# info.reasonNotFound

it could not be found on this org

# info.reasonNotAccessible

it is not accessible on this org

# info.reasonNotQualified

it is accessible on this org only under a qualified spelling — re-run naming the qualified spelling

# info.reasonNoCoverage

it contributed no covered lines

# info.reasonDoesNotCompile

it does not compile%s

# error.apexClassNotFound

Apex class '%s' not found.

# error.apexClassNotMutable

Apex class '%s' cannot be modified on this org (manageable state: %s). Only classes this org owns — unmanaged, unlocked-package or packaging-org source — can be mutated.

# error.apexClassAmbiguous

Apex class '%s' matches more than one modifiable Apex class on this org: %s. Re-run naming one of them.

# error.apexClassUnqualified

Apex class '%s' is modifiable on this org only as '%s'. A bare name reaches only the namespace that owns it — re-run naming the qualified spelling.

# error.noUsableTestClass

No usable Apex test class remains in the perimeter for '%s'. The following test class(es) were skipped:
%s
