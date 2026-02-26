# Apex Mutation Testing

[![NPM](https://img.shields.io/npm/v/apex-mutation-testing.svg?label=apex-mutation-testing)](https://www.npmjs.com/package/apex-mutation-testing) [![Downloads/week](https://img.shields.io/npm/dw/apex-mutation-testing.svg)](https://npmjs.org/package/apex-mutation-testing) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/scolladon/apex-mutation-testing/main/LICENSE.md)
![GitHub Sponsors](https://img.shields.io/github/sponsors/scolladon)

## Disclaimer

This project is in its early stages and requires further development.
It provides a solid foundation for implementing additional features and improvements.
You are welcome to contribute by logging issue, proposing enhancements or pull requests.

## TL;DR

```sh
sf plugins install apex-mutation-testing
```

```sh
sf apex mutation test run --apex-class MyClass --test-class MyClassTest
```

## What is it mutation testing ?

Mutation testing is a software testing technique that evaluates the quality of your test suite by introducing small changes (mutations) to your code and checking if your tests can detect these changes. It helps identify weaknesses in your test coverage by measuring how effectively your tests can catch intentional bugs. cf [wikipedia](https://en.wikipedia.org/wiki/Mutation_testing)

The apex-mutation-testing plugin implements this technique for Salesforce Apex code by:

1. Parsing your Apex class to identify potential mutation points
2. Generating mutated versions of your code with specific changes
3. Deploying each mutated version to a Salesforce org
4. Running your test class against each mutation
5. Analyzing the results to determine if your tests:
   - Detected the mutation (killed the mutant)
   - Failed to detect the mutation (created a zombie)
   - Caused a test failure unrelated to the mutation
6. Generating a detailed report showing mutation coverage and test effectiveness

This process helps you identify areas where your tests may be insufficient and provides insights into improving your test quality.

cf this [idea](https://ideas.salesforce.com/s/idea/a0B8W00000GdmxmUAB/use-mutation-testing-to-stop-developers-from-cheating-on-apex-tests) for more information about the community appetit

## How to use it?

Fast unit tests are crucial for mutation testing as each detected mutation is deployed and tested individually. The plugin generates numerous mutations, and having quick-running tests allows for:

1. Efficient execution of the mutation testing process
2. Faster feedback on test coverage quality
3. Ability to test more mutations within time constraints
4. Reduced resource consumption during testing
5. More iterations and improvements in test quality

The more the test interacts with the database (dml or soql) the more times the test will take

### Test Coverage Requirements

To maximize the benefits of mutation testing, your test class should have very high code coverage (ideally 100%) **AND** meaningful assert. Here's why:

1. **Accurate Metrics**: High coverage ensures the mutation score accurately reflects your test suite's effectiveness.

2. **Meaningful Results**: With high coverage, the mutation test results provide actionable insights about your test quality.

3. **Mutation Detection**: Mutations detection can be optimized by being scoped to code that is executed by your tests. Uncovered code means not relevant mutations for your tests.

Before running mutation testing:

- Ensure your test class achieves maximum coverage
- Verify all critical paths are tested
- Include edge case scenarios
- Validate test assertions are comprehensive

Remember, mutation testing complements but doesn't replace good test coverage. It helps identify weaknesses in your existing tests, but only for the code they already cover.

### Dry Run

Before running the full mutation testing process, you can preview the mutations that would be generated using the `--dry-run` flag:

```sh
sf apex mutation test run --apex-class MyClass --test-class MyClassTest --dry-run
```

This runs your test class once to collect coverage data, then lists all mutations that would be generated without deploying any of them. Use it to estimate the scope of mutation testing for your class and verify that relevant mutations are being generated for your code patterns.

In both normal and dry-run modes, the plugin displays a time estimate before starting the mutation loop, showing the estimated total duration along with a per-mutant breakdown of deployment and test execution time.

### Compilability Verification

Before running mutation tests, the plugin deploys both the target class and its test class back to the org to verify they compile correctly. This step is necessary because Salesforce only validates compilation of the element being deployed, not its dependents. A class can exist on the org in a broken state if one of its dependencies was modified after it was last deployed.

Without this check, all mutants would result in `CompileError`, producing a misleading 100% mutation score. If either class fails to compile, the process stops early with a clear error message showing the compilation details.

This verification also serves as a baseline to measure deployment time, which is used to estimate the total mutation testing duration.

### Supported Mutation Operators

The plugin currently supports the following mutation operators. If your code doesn't contain any of these patterns on covered lines, no mutations will be generated:

| Operator         | Description                            | Example                              |
| ---------------- | -------------------------------------- | ------------------------------------ |
| **Arithmetic**   | Swaps arithmetic operators             | `a + b` → `a - b`, `a * b` → `a / b` |
| **Boundary**     | Modifies comparison boundaries         | `<` → `<=`, `>` → `>=`               |
| **Equality**     | Swaps equality operators               | `==` → `!=`, `!=` → `==`             |
| **Increment**    | Swaps increment/decrement              | `i++` → `i--`, `--i` → `++i`         |
| **True Return**  | Replaces true returns                  | `return true` → `return false`       |
| **False Return** | Replaces false returns                 | `return false` → `return true`       |
| **Null Return**  | Replaces object returns with null      | `return obj` → `return null`         |
| **Empty Return** | Removes return values for void methods | `return value` → `return`            |

### Mutation Result Statuses

Each mutant is assigned a status after evaluation:

#### Killed

A **Killed** mutant means your tests detected the mutation and failed as a result. This is the ideal outcome. It proves your tests are actively verifying the behavior that was changed. For example, if `subTotal + tax` is mutated to `subTotal - tax` and your test fails, the mutant is killed.

**What to look for:** A high number of killed mutants indicates strong, assertion-rich tests that validate actual logic and branch coverage rather than just executing code paths.

#### Survived

A **Survived** mutant means the mutation was introduced, your tests ran against it, and they all still passed. This is the most actionable status. It reveals a gap in your test assertions. The code was changed, but no test noticed. 

**What to look for:** Survived mutants highlight areas where you need stronger assertions. Common causes include:
- Missing assertions on return values or side effects
- Tests that only check happy-path structure without verifying computed values
- Assertions that are too broad (e.g. checking not-null instead of checking the exact value)

#### CompileError

A **CompileError** mutant means the mutated code failed to compile during deployment, so no tests were run against it. This typically happens when a mutation tool produces syntactically invalid Apex code. You may ignore these and report them as an issue to us. 

**What to look for:** Compile errors are excluded from the score entirely. They do not indicate a problem with your tests. The mutation simply wasn't valid for that code.

#### RuntimeError

A **RuntimeError** means an unexpected error occurred during the mutation evaluation. These errors are the result of networking issues, authorization issues, or other issues not directly related to your code. 

**What to look for:** A high number of runtime errors may indicate connectivity or org stability issues. If you see many runtime errors, consider re-running the mutation test when the environment is more stable to get more accurate results.

#### NoCoverage

A **NoCoverage** mutant means the mutated line is not covered by any of your test methods. Since the test never executes that line, the mutation cannot be detected. These mutants count against your score the same way survived mutants do.

**What to look for:** NoCoverage mutants point to lines your tests never reach. Adding tests that exercise those code paths will both improve your code coverage and your mutation score.

#### Mutation Score

The mutation score measures how effective your tests are at detecting code changes:

```
Score = (Killed + RuntimeError) / (Killed + RuntimeError + Survived + NoCoverage) * 100
```

- **CompileError** mutants are excluded from the total since they represent invalid mutations, not test gaps.
- **Survived** and **NoCoverage** mutants lower your score because they represent undetected changes.

A higher score means your tests are better at catching real bugs. Aim to reduce survived mutants by adding targeted assertions for the specific logic each surviving mutation affected.

<!-- commands -->
* [`sf apex mutation test run`](#sf-apex-mutation-test-run)

## `sf apex mutation test run`

Evaluate test coverage quality by injecting mutations and measuring test detection rates

```
USAGE
  $ sf apex mutation test run -c <value> -t <value> -o <value> [--json] [--flags-dir <value>] [-r <value>] [-d]
    [--api-version <value>]

FLAGS
  -c, --apex-class=<value>   (required) Apex class name to mutate
  -d, --dry-run              Preview mutations without deploying or running tests
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -r, --report-dir=<value>   [default: mutations] Path to the directory where mutation test reports will be generated
  -t, --test-class=<value>   (required) Apex test class name to validate mutations
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Evaluate test coverage quality by injecting mutations and measuring test detection rates

  The Apex Mutation Testing plugin helps evaluate the effectiveness of your Apex test classes by introducing mutations
  into your code and checking if your tests can detect these changes:

  The plugin provides insights into how trustworthy your test suite is by measuring its ability to catch intentional
  code changes.

EXAMPLES
  Run mutation testing on a class with its test file:

    $ sf apex mutation test run --apex-class MyClass --test-class MyClassTest

  Preview mutations without running them:

    $ sf apex mutation test run --apex-class MyClass --test-class MyClassTest --dry-run
```

_See code: [src/commands/apex/mutation/test/run.ts](https://github.com/scolladon/apex-mutation-testing/blob/main/src/commands/apex/mutation/test/run.ts)_
<!-- commandsstop -->

## Backlog

- **Expand Mutation Types**: Add more mutation operators to test different code patterns
- **Smart Mutation Detection**: Implement logic to identify relevant mutations for specific code contexts
- **Coverage Analysis**: Detect untested code paths that mutations won't affect
- **Performance Optimization**: Add CPU time monitoring to fail fast on non ending mutation
- **Better Configurability**: Pass threashold and use more information from test class
- **Additional Features**: Explore other mutation testing enhancements and quality metrics

## Changelog

[changelog.md](CHANGELOG.md) is available for consultation.

## Versioning

Versioning follows [SemVer](http://semver.org/) specification.

## Authors

- **Sebastien Colladon** - Developer - [scolladon](https://github.com/scolladon)
- **Saman Attar** - Developer - [saman](https://github.com/SamanAttar)

Special thanks to **Sara Sali** for her [presentation at Dreamforce](https://www.youtube.com/watch?v=8PjzrTaNNns) about apex mutation testing
This repository is basically a port of her idea / repo to a sf plugin.

## Contributing

Contributions are what make the trailblazer community such an amazing place. I regard this component as a way to inspire and learn from others. Any contributions you make are **appreciated**.

See [contributing.md](CONTRIBUTING.md) for sgd contribution principles.

## License

This project license is MIT - see the [LICENSE.md](LICENSE.md) file for details
