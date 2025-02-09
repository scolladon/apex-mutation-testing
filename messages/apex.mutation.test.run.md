# summary

Evaluate test coverage quality by injecting mutations and measuring test detection rates

# description

The Apex Mutation Testing plugin helps evaluate the effectiveness of your Apex test classes by introducing mutations into your code and checking if your tests can detect these changes:

The plugin provides insights into how trustworthy your test suite is by measuring its ability to catch intentional code changes.

# flags.class-file.summary

Path to the Apex class file to be tested for mutation coverage

# flags.test-file.summary

Path to the Apex test file that will be used to validate mutations

# flags.report-dir.summary

Path to the directory where mutation test reports will be generated

# examples

- Run mutation testing on a class with its test file:

  <%= config.bin %> <%= command.id %> --class-file MyClass.cls --test-file MyClassTest.cls

- Run mutation testing with specific class and test files:

  <%= config.bin %> <%= command.id %> --class-file path/to/MyClass.cls --test-file path/to/MyClassTest.cls
