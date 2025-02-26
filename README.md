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
sf apex mutation test run --class-file MyClass --test-file MyClassTest
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

To maximize the benefits of mutation testing, your test class should have very high code coverage (ideally 100%) **AND** meaningfull assert. Here's why:

1. **Accurate Metrics**: High coverage ensures the mutation score accurately reflects your test suite's effectiveness.

2. **Meaningful Results**: With high coverage, the mutation test results provide actionable insights about your test quality.

3. **Mutation Detection**: Mutations detection can be optmized by being scoped to code that is executed by your tests. Uncovered code means unmeaningful mutations for your tests.

Before running mutation testing:
- Ensure your test class achieves maximum coverage
- Verify all critical paths are tested
- Include edge case scenarios
- Validate test assertions are comprehensive

Remember, mutation testing complements but doesn't replace good test coverage. It helps identify weaknesses in your existing tests, but only for the code they already cover.

<!-- commands -->
* [`sf apex mutation test run`](#sf-apex-mutation-test-run)

## `sf apex mutation test run`

Evaluate test coverage quality by injecting mutations and measuring test detection rates

```
USAGE
  $ sf apex mutation test run -c <value> -t <value> -o <value> [--json] [--flags-dir <value>] [-r <value>] [--api-version
    <value>]

FLAGS
  -c, --apex-class=<value>   (required) Apex class name to mutate
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

    $ sf apex mutation test run --class-file MyClass --test-file MyClassTest
```
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

Special thanks to **Sara Sali** for her [presentation at Dreamforce](https://www.youtube.com/watch?v=8PjzrTaNNns) about apex mutation testing
This repository is basically a port of her idea / repo to a sf plugin.

## Contributing

Contributions are what make the trailblazer community such an amazing place. I regard this component as a way to inspire and learn from others. Any contributions you make are **appreciated**.

See [contributing.md](CONTRIBUTING.md) for sgd contribution principles.

## License

This project license is MIT - see the [LICENSE.md](LICENSE.md) file for details
