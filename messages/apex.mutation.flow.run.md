# summary

Run mutation testing on Salesforce Flow XML definitions using FlowTests

# description

Evaluate Flow test coverage and test suite quality by injecting mutations into a target Flow XML definition and executing FlowTests to determine whether intentional bugs are detected (killed) or go undetected (survived).

Only Record-Triggered Flows and Autolaunched Flows without Pause elements can be tested.

# flags.flow.summary

Developer name of the Flow (e.g. Account_After) or path to its XML file (*.flow-meta.xml).

# flags.flow-file.summary

Path to the target Flow XML file (*.flow-meta.xml) to mutate.

# flags.flow-name.summary

Developer name of the Flow. If omitted, it is inferred from the flow flag.

# flags.flow-tests.summary

Specific flow test names to run (e.g., Flow1.Test1). Repeat the flag or pass a comma-separated list.

# flags.test-apex.summary

Specific Apex test classes to run against the Flow (e.g., DiscountCalculatorTest). Repeat the flag or pass a comma-separated list. Can also be specified as -ta.

# flags.dry-run.summary

Preview generated Flow mutants without deploying to an org or running tests.

# flags.lines.summary

Line numbers or ranges in the Flow XML to mutate (e.g. '10-25', '40'). Repeat the flag or pass multiple values.

# flags.threshold.summary

Minimum mutation score threshold (0-100). The command fails if the score is below this threshold.

# flags.report-dir.summary

Path to the directory where mutation test reports will be generated.

# info.reportGenerated

Report has been generated at this location: %s

# info.CommandIsRunning

Running mutation testing for Flow "%s" with test(s) "%s"

# info.ApexTestCommandIsRunning

Running mutation testing for Flow "%s" with Apex test class(es) "%s"

# info.DryRunCommandIsRunning

Running dry run mutation testing for Flow "%s"

# info.timeEstimate

Estimated time: %s

# info.timeEstimateBreakdown

Deploy: %s/iteration | Test: %s/iteration | Mutants: %s | Groups: %s

# error.flowNotFoundLocally

Flow "%s" was not found in the local project directory. Specify a valid file path or provide --target-org to retrieve it from Salesforce.

# examples

- Preview generated mutations for a Flow by name without running tests:

  <%= config.bin %> <%= command.id %> -f Account_Before --dry-run

- Run mutation testing for a Flow by name against an org:

  <%= config.bin %> <%= command.id %> -f Account_After --target-org Winter27

- Run mutation testing specifying specific FlowTests and line range:

  <%= config.bin %> <%= command.id %> -f Account_Before -t Account_Before.Should_set_Rating_from_Parent --lines 45-65 --target-org FlowTestPresentation

- Run mutation testing using an Apex test class:

  <%= config.bin %> <%= command.id %> -f Account_After -ta DiscountCalculatorTest --target-org Winter27
