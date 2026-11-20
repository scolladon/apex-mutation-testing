# summary

Evaluate FlowTest quality by injecting mutations into a Flow and checking whether its FlowTests detect them

# description

Reads the Flow and its FlowTests from the org, deploys each mutant, runs the FlowTests against it, and restores the org to exactly the state the run started from. Nothing in the local project is read or written, except the optional configuration file.

Only record-triggered and autolaunched Flows without Pause or Screen elements can be tested, and the target org must be a sandbox, a scratch org or a Developer Edition org (Trailhead playgrounds included): the command refuses any other org, and any org with a namespace, dry runs included. Requires API version 66.0 or later.

FlowTests only run against the Flow's Active version, or its latest version when none is Active. When the latest version is Active, each mutant is deployed as a temporary version that is activated for the duration of its FlowTests — so the mutant is live in the sandbox meanwhile — after which the original version is activated again and the temporary version deleted. A Flow has room for 50 versions; the run needs one free slot for its temporary version. When no version is Active and the latest is a Draft, the run overwrites that Draft and restores its original content at the end. A Draft beside an Active version is refused: it cannot be tested without activating it. FlowTests are detached from their flow versions for the run and restored at the end, and the version every FlowTest ran against is checked after each run. A version or FlowTest somebody else changes during the run is never written over: the run stops instead.

# flags.flow.summary

API name of the Flow to mutate (e.g. Account_After)

# flags.flow-test.summary

FlowTests to run, by API name (e.g. Should_set_Rating, Account_After.Should_set_Rating or FlowTesting.Account_After.Should_set_Rating). Defaults to every FlowTest of the Flow. Repeat the flag or pass a comma-separated list.

# flags.dry-run.summary

Preview mutations without deploying or running tests

# flags.include-mutators.summary

Mutator names to include (e.g. DecisionOperator, ConnectorBypass)

# flags.exclude-mutators.summary

Mutator names to exclude

# flags.config-file.summary

Path to mutation testing configuration file; the Flow command reads its "flow" section and its top-level "threshold"

# flags.lines.summary

Line ranges of the Flow's XML as retrieved from the org (e.g., 1-10, 42), which may differ from a local copy. Only mutants on these lines are evaluated; run with --dry-run first to see each mutant's line in the report.

# flags.threshold.summary

Minimum mutation score (0-100) required for the command to succeed

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

# info.CommandIsRunningAllTests

Running mutation testing for Flow "%s" with all of its FlowTests

# info.DryRunCommandIsRunningAllTests

Running dry run mutation testing for Flow "%s" with all of its FlowTests

# info.hasScheduledPath

This Flow contains a Scheduled Path. Already scheduled actions might not work properly during mutations.

# info.hasAsyncPath

This Flow contains an Async Path. FlowTests do not run it, so its elements get no mutants.

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

Deploy and revert: %s/mutant | Test: %s/mutant | Mutants: %s

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

Restore failed

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

Invalid FlowTest name: '%s'. A FlowTest API name starts with a letter and contains only letters, digits and underscores, optionally prefixed by "<Flow API name>." or "FlowTesting.<Flow API name>.".

# error.blankFlowTest

A FlowTest name is empty. Remove empty entries from the -t/--flow-test flag.

# error.productionOrg

The target org is not a sandbox, a scratch org or a Developer Edition org. Flow mutation testing deploys and activates Flow versions and is only allowed on those orgs (Trailhead playgrounds are Developer Edition orgs), dry runs included.

# error.namespacedOrg

The target org has the namespace prefix '%s'. FlowTests cannot be run by name in an org with a namespace, so Flow mutation testing is not supported there.

# error.apiVersionTooLow

Flow mutation testing requires API version %s or later, but the connection uses %s. Pass --api-version %s or later.

# error.flowNotFound

Flow '%s' was not found on the target org. Pass the Flow's API name, not its label (Setup > Flows lists both).

# error.flowAmbiguous

Flow '%s' matches %s flow definitions on the target org, e.g. one of them from a managed package. Mutation testing needs a single definition with this API name.

# error.noFlowTests

Flow '%s' has no FlowTest on the target org. Create FlowTests for it before running mutation testing.

# error.flowTestNotFound

FlowTest(s) not found for Flow '%s': %s. Flow Builder lists a Flow's FlowTests under View Tests; pass their API names.

# error.unsupportedFlowVersionState

The latest version of Flow '%s' has status '%s'. Mutation testing only supports a Flow whose latest version is Active, or a Draft when no version is Active.

# error.flowDraftBesideActive

The latest version of Flow '%s' (version %s) is a Draft beside the Active version %s. FlowTests only run against the Active version, and testing the Draft would mean activating it, after which it can never be a Draft again. Activate or delete the Draft, then run again.

# error.flowVersionLimit

Flow '%s' already has %s versions, the maximum of %s. Delete an obsolete version so the run can create its temporary Draft version.

# error.flowLeftoverVersion

Flow '%s' has versions marked [apex-mutation-testing] (%s): an interrupted run of this command left them, and they hold mutants, not your Flow. Put the Flow back as it was — activate its original version and delete the marked ones, or deploy its original Draft from your source — restore the flow-version associations of its FlowTests if they had any, then run again.

# error.flowTestLeftover

FlowTest '%s' of Flow '%s' carries the [apex-mutation-testing] marker: an interrupted run of this command detached it from its flow versions. Before running again, associate it again with the versions it had (%s) and remove the marker from its description.

# error.flowChangedOutsideRun

Flow '%s' was changed outside this run (versions %s): a version was saved, added, removed, activated or deactivated since the run last deployed it. The run was stopped without writing over that change, and only the versions the run created are deleted.

# error.flowChangedBeforeRun

Flow '%s' changed while the run was reading it (versions %s). Nothing was written to the org; run again.

# error.flowTestChangedBeforeRun

FlowTests changed while the run was reading them: %s. Nothing was written to the org; run again.

# error.flowTestChangedOutsideRun

FlowTests not restored, because they no longer hold what this run left in them (changed or deleted outside the run), or that could not be confirmed: %s. Associate them again with their flow versions on the target org; the [apex-mutation-testing pins=…] marker in their description lists those versions.

# error.flowVersionGuard

The versions of Flow '%s' changed unexpectedly (expected %s, found %s). The run was stopped to keep the org in a known state.

# error.flowTestPin

FlowTest '%s' did not come back free of flow-version associations after its deploy. The run was stopped: the FlowTest would have been skipped for the versions under test.

# error.flowTestRestoreMarked

FlowTest '%s' was deployed back with its versions (%s) but came back still carrying the [apex-mutation-testing pins=…] marker in its description. Remove the marker from its description on the target org.

# error.flowTestRestoreMissing

FlowTest '%s' was deployed back with its versions (%s) but could not be read back. Check that it exists on the target org and is associated with those versions.

# error.flowTestRestorePin

FlowTest '%s' was deployed back with its versions (%s) but came back associated with %s. Check its flow-version associations on the target org.

# error.flowTestsNotRun

FlowTests of Flow '%s' did not run: %s. A FlowTest that does not run is not evidence about the version under test, so the run does not read the silence as a pass.

# error.flowDeployNotCompleted

Metadata API deploy %s did not complete (%s): %s. What it changed is unknown, so the run was stopped. Check Setup > Deployment Status and the Flow's versions on the target org.

# error.flowForeignActiveVersion

Flow '%s' has %s, which this run did not set: version %s is not activated again over it. Check the Flow's versions on the target org.

# error.flowActiveVersionNotDeleted

Version %s, created by this run, is Active and is not deleted. Activate the Flow's original version again, then delete it.

# error.runtimeErrorStreak

%s mutants of Flow '%s' in a row could not be run (%s). The run was stopped: check the session, the Flow's FlowTests and the org.

# error.flowTestVersion

The FlowTests of Flow '%s' were expected to run against version %s, but the org recorded results for: %s. The run was stopped: its verdicts would not describe the mutants.

# error.flowRevert

Flow '%s' could not be put back to its original Active version after a mutant. The run was stopped: %s

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

# error.flowInvalid.deleteTriggered

Flow '%s' runs when a record is deleted. FlowTests cannot test a delete-triggered Flow.

# error.flowInvalid.platformEventTriggered

Flow '%s' is triggered by a platform event. FlowTests cannot test a platform event-triggered Flow.

# error.flowInvalid.scheduleTriggered

Flow '%s' runs on a schedule. FlowTests cannot test a schedule-triggered Flow.

# error.flowInvalid.hasPauseElements

Flow '%s' contains Pause elements. Flows with Pause elements cannot be tested with FlowTests.

# error.flowInvalid.hasScreenElements

Flow '%s' contains Screen elements. Screen Flows cannot be tested with FlowTests.

# error.noMutations

No mutations could be generated for Flow '%s': none of its elements is one the mutators change (decision conditions, assignments, formulas, the record trigger, elements between connectors), or they are only on its Async Path.

# error.allMutatorsExcluded

All mutators have been excluded by configuration

# error.noMutationsWithMutatorFilter

No mutations could be generated for Flow '%s' with the requested mutators. Widen --include-mutators or --exclude-mutators, or the "flow" section of the configuration file.

# error.noMutationsInLineRange

No mutations could be generated for Flow '%s' within the requested --lines range (%s). Run with --dry-run and without --lines to see the lines of every mutant in the report.

# error.baselineTestsFailed

The FlowTests of Flow '%s' fail against the original Flow: %s. Fix them before running mutation testing.

# error.flowRestoreFailed

Flow '%s' and its FlowTests could not be fully restored: %s. Check the Flow's versions and FlowTests on the target org and restore them manually.

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

# error.configFileUnreadable

Failed to parse config file '%s': %s

# error.configFieldNotStringArray

Invalid '%s' in config file '%s': expected an array of strings (for example ["DecisionOperator"]), found %s. A bare value is not accepted — wrap it in an array.

# error.configEntryNotString

Invalid entry at '%s' in config file '%s': expected a string, found %s.

# error.configFieldNotNumber

Invalid '%s' in config file '%s': expected a number, found %s.

# error.configFieldNotBoolean

Invalid '%s' in config file '%s': expected a boolean, found %s.

# error.mutuallyExclusiveMutators

Cannot specify both includeMutators and excludeMutators

# error.thresholdOutOfRange

Threshold must be between 0 and 100
