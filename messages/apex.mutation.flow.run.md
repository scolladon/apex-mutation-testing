# summary

Evaluate FlowTest quality by injecting mutations into a Flow and checking whether its FlowTests detect them

# description

Reads the Flow and its FlowTests from the org, deploys each mutant, runs the FlowTests against it, and restores the org to exactly the state the run started from. Nothing in the local project is read or written.

Only record-triggered and autolaunched Flows without Pause or Screen elements can be tested, and the target org must be a sandbox or a scratch org: the command refuses any other org, dry runs included, unless --allow-non-sandbox-org is passed (e.g. Developer Edition or Trailhead orgs). Requires API version 66.0 or later.

FlowTests only run against the Flow's Active version, or its latest version when none is Active. When the latest version is Active, each mutant is deployed as a temporary version that is activated for the duration of its FlowTests — so the mutant is live in the sandbox meanwhile — after which the original version is activated again and the temporary version deleted. A Flow has room for 50 versions; the run needs one free slot for its temporary version. When no version is Active and the latest is a Draft, the run overwrites that Draft and restores its original content at the end. A Draft beside an Active version is refused: it cannot be tested without activating it. FlowTests are detached from their flow versions for the run and restored at the end, and the version every FlowTest ran against is checked after each run.

# flags.flow.summary

API name of the Flow to mutate (e.g. Account_After)

# flags.flow-test.summary

FlowTests to run (e.g. Should_set_Rating). Defaults to every FlowTest of the Flow. Repeat the flag or pass a comma-separated list.

# flags.dry-run.summary

Preview mutations without deploying or running tests

# flags.lines.summary

Line ranges of the Flow XML to mutate (e.g., 1-10, 42). Only these lines are eligible for mutation.

# flags.threshold.summary

Minimum mutation score (0-100) required for the command to succeed

# flags.allow-non-sandbox-org.summary

Potentially unsafe. Allow running against an org that is not a sandbox or scratch org (e.g. Developer Edition or Trailhead). Skips the sandbox check entirely, production included: use only on orgs where deploying and activating Flow versions is safe.

# flags.report-dir.summary

Path to the directory where mutation test reports will be generated

# examples

- Preview the mutations of a Flow:

  <%= config.bin %> <%= command.id %> -f Account_Before -o MySandbox --dry-run

- Run mutation testing for a Flow with every one of its FlowTests:

  <%= config.bin %> <%= command.id %> -f Account_After -o MySandbox

- Run mutation testing with one FlowTest, on a line range:

  <%= config.bin %> <%= command.id %> -f Account_Before -t Should_set_Rating_from_Parent --lines 45-65 -o MySandbox

# info.CommandIsRunning

Running mutation testing for Flow "%s" with FlowTest(s) "%s"

# info.DryRunCommandIsRunning

Running dry run mutation testing for Flow "%s" with FlowTest(s) "%s"

# info.allFlowTests

all FlowTests

# info.readingFlow

Reading Flow "%s" and its FlowTests from the org

# info.flowRead

FlowTests: %s

# info.generatingMutants

Generating mutants for Flow "%s"

# info.mutantsGenerated

%s mutations generated

# info.preparingFlowVersion

Preparing Flow "%s" and its FlowTests for the run

# info.done

Done

# info.runningBaseline

Running %s FlowTest(s) against the original Flow

# info.baselinePassed

Original tests passed

# info.baselineFailed

Original tests failed

# info.timeEstimate

Estimated time: %s

# info.timeEstimateBreakdown

Deploy: %s/mutant | Test: %s/mutant | Mutants: %s

# info.progressStarting

Starting mutation testing

# info.evaluatingMutant

Evaluating mutant: %s

# info.mutantResult.Killed

Mutation result: mutant killed

# info.mutantResult.Survived

Mutation result: zombie

# info.mutantResult.CompileError

Mutation result: compile error

# info.mutantResult.RuntimeError

Mutation result: runtime error

# info.progressFinished

All mutations evaluated

# info.progressTeardownFailed

Warning: could not tear down the progress display. Cause: %s

# info.restoringFlow

Restoring Flow "%s" and its FlowTests to their original state

# info.restoreFailed

Restore FAILED

# info.activeVersion

%s Active

# info.noActiveVersion

none Active

# info.noFlowTestResult

no recorded result

# info.reportGenerated

Report has been generated at this location: %s

# info.CommandSuccess

Mutation score: %s%

# info.EncourageSponsorship

💡 Enjoying apex-mutation-testing?
Your contribution helps us provide fast support 🚀 and high quality features 🔥
Become a sponsor: https://github.com/sponsors/scolladon 💙

# info.syncTransportFallback

Synchronous test execution is unavailable (%s). Falling back to the asynchronous transport.

# info.typeResolutionDegraded

Type resolution degraded for %s: these types could not be resolved against the org, so type-aware mutators fall back to untyped behaviour and some mutants are not generated%s.

# error.invalidFlowName

Invalid Flow API name: '%s'. A Flow API name starts with a letter and contains only letters, digits and underscores.

# error.invalidFlowTestName

Invalid FlowTest name: '%s'. A FlowTest name contains only letters, digits and underscores, optionally prefixed by the Flow API name and a dot.

# error.productionOrg

The target org is not a sandbox. Flow mutation testing deploys and activates Flow versions and is only allowed on sandboxes and scratch orgs, dry runs included. To run against a Developer Edition or Trailhead org, pass --allow-non-sandbox-org.

# error.apiVersionTooLow

Flow mutation testing requires API version %s or later, but the connection uses %s. Pass --api-version %s or later.

# error.flowNotFound

Flow '%s' was not found on the target org.

# error.flowAmbiguous

Flow '%s' matches %s flow definitions on the target org.

# error.noFlowTests

Flow '%s' has no FlowTest on the target org. Create FlowTests for it before running mutation testing.

# error.flowTestNotFound

FlowTest(s) not found for Flow '%s': %s.

# error.unsupportedFlowVersionState

The latest version of Flow '%s' has status '%s'. Mutation testing only supports a Flow whose latest version is Active, or a Draft when no version is Active.

# error.flowDraftBesideActive

The latest version of Flow '%s' (version %s) is a Draft beside the Active version %s. FlowTests only run against the Active version, and testing the Draft would mean activating it, after which it can never be a Draft again. Activate or delete the Draft, then run again.

# error.flowVersionLimit

Flow '%s' already has %s versions, the maximum of %s. Delete an obsolete version so the run can create its temporary Draft version.

# error.flowVersionGuard

The versions of Flow '%s' changed unexpectedly (expected %s, found %s). The run was stopped to keep the org in a known state.

# error.flowTestPin

FlowTest '%s' did not come back free of flow-version associations after its deploy. The run was stopped: the FlowTest would have been skipped for the versions under test.

# error.flowTestVersion

The FlowTests of Flow '%s' were expected to run against version %s, but the org recorded results for: %s. The run was stopped: its verdicts would not describe the mutants.

# error.flowRevert

Flow '%s' could not be put back to its original Active version after a mutant: %s. The run was stopped.

# error.flowDeployFailed

The target org refuses to deploy or activate the original content of Flow '%s', so no mutant could be evaluated: %s

# error.flowTestRepinFailed

The FlowTests could not be detached from their flow versions for the run: %s

# error.flowInvalid.invalidXml

Flow '%s' is not valid XML: %s

# error.flowInvalid.notAFlow

Flow '%s' does not have a <Flow> root element in the Salesforce metadata namespace.

# error.flowInvalid.unsupportedProcessType

Flow '%s' has process type '%s'. Only record-triggered and autolaunched Flows can be tested with FlowTests.

# error.flowInvalid.hasPauseElements

Flow '%s' contains Pause elements. Flows with Pause elements cannot be tested with FlowTests.

# error.flowInvalid.hasScreenElements

Flow '%s' contains Screen elements. Screen Flows cannot be tested with FlowTests.

# error.noMutations

No mutations could be generated for Flow '%s'.

# error.noMutationsInLineRange

No mutations could be generated for Flow '%s' within the requested --lines range (%s).

# error.baselineTestsFailed

The FlowTests of Flow '%s' fail against the original Flow: %s. Fix them before running mutation testing.

# error.flowRestoreFailed

Restoring Flow '%s' failed: %s. Check the Flow's versions and FlowTests on the target org and restore them manually.

# error.thresholdNotMet

Mutation score %s% is below the required threshold of %s%

# error.invalidLineRange

Invalid line range '%s': must be a number or range (e.g., '10' or '1-10')

# error.invalidLineRangeOrder

Invalid line range '%s': start must be less than or equal to end

# error.reportDirOutsideCwd

Report directory '%s' resolves outside the current working directory (%s). Refusing to write reports outside the project root.

# error.reportDirSymlinkOutsideCwd

Report directory '%s' dereferences to '%s', outside the current working directory (%s). Refusing to follow symlinks out of the project root.
