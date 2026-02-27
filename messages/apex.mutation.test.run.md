# summary

Evaluate test coverage quality by injecting mutations and measuring test detection rates

# description

The Apex Mutation Testing plugin helps evaluate the effectiveness of your Apex test classes by introducing mutations into your code and checking if your tests can detect these changes:

The plugin provides insights into how trustworthy your test suite is by measuring its ability to catch intentional code changes.

# flags.apex-class.summary

Apex class name to mutate

# flags.test-class.summary

Apex test class name to validate mutations

# flags.report-dir.summary

Path to the directory where mutation test reports will be generated

# examples

- Run mutation testing on a class with its test file:

  <%= config.bin %> <%= command.id %> --apex-class MyClass --test-class MyClassTest

- Preview mutations without running them:

  <%= config.bin %> <%= command.id %> --apex-class MyClass --test-class MyClassTest --dry-run

# info.reportGenerated

Report has been generated at this location: %s

# info.CommandIsRunning

Running mutation testing for "%s" with "%s" test class

# info.DryRunCommandIsRunning

Running dry run mutation testing for "%s" with "%s" test class

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

# error.noMutations

No mutations could be generated for '%s'. %s line(s) covered but no mutable patterns found.

# flags.dry-run.summary

Preview mutations without deploying or running tests

# error.compilabilityCheckFailed

The Apex class '%s' does not compile on the target org. This can happen when a dependency was modified after the class was last deployed. Fix compilation errors before running mutation testing.\nError: %s

# info.timeEstimate

Estimated time: %s

# info.timeEstimateBreakdown

Deploy: %s/mutant | Test: %s/mutant | Mutants: %s

# flags.include-mutators.summary

Mutator names to include (e.g. ArithmeticOperator, BoundaryCondition)

# flags.exclude-mutators.summary

Mutator names to exclude

# flags.include-test-methods.summary

Test method names to include

# flags.exclude-test-methods.summary

Test method names to exclude

# flags.threshold.summary

Minimum mutation score (0-100) required for the command to succeed

# flags.config-file.summary

Path to mutation testing configuration file

# flags.skip-patterns.summary

RE2 regex patterns to skip lines from mutation (e.g., System\.debug)

# flags.lines.summary

Line ranges to mutate (e.g., 1-10, 42). Only these lines are eligible for mutation.

# error.thresholdNotMet

Mutation score %s% is below the required threshold of %s%
