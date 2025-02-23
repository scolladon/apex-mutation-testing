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

  <%= config.bin %> <%= command.id %> --class-file MyClass --test-file MyClassTest

# info.reportGenerated

Report has been generated at this location: %s

# info.CommandIsRunning

Running mutation testing for "%s" with "%s" test class

# info.CommandSuccess

Mutation score: %s%

# info.CommandFailure

Failure

# info.EncourageSponsorship

💡 Enjoying apex-mutation-testing?
Your contribution helps us provide fast support 🚀 and high quality features 🔥
Become a sponsor: https://github.com/sponsors/scolladon 💙