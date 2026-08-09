[![OSS Apex Tests](https://github.com/octoberswimmer/aer-dist/actions/workflows/oss-tests.yml/badge.svg)](https://github.com/octoberswimmer/aer-dist/actions/workflows/oss-tests.yml)

# aer

**Run Apex and Apex unit tests locally — no org, no deploy.**

`aer` (Apex Execution Runtime) runs your Apex code and tests on your own machine.
There's no scratch org to spin up, no sandbox to deploy to, and no API calls to an
org. It loads your Apex and the metadata next to it — classes, triggers, flows,
objects, and more — so SOQL, DML, and test data behave the way they do in
Salesforce.

Because everything runs locally, your feedback loop is the speed of a local binary
instead of a deploy-and-poll cycle against an org: run a focused test class in about
the time it takes to save a file.

**Use `aer` to:**
- Run Apex unit tests locally, with code coverage, from the CLI or in CI.
- Execute anonymous Apex against your local metadata.
- Step through Apex in an interactive debugger (VS Code or IntelliJ) — set
  breakpoints, inspect variables, and walk logic line by line.

![Demo](demo.gif)

## What aer supports

`aer` aims to behave like the Salesforce Apex runtime. It runs
against an embedded database seeded from your metadata, so the parts of Apex that
normally require an org work locally:

- **SObjects & database** — SOQL (WHERE, ORDER BY, LIMIT, relationship queries),
  DML (insert/update/delete/undelete), the `Database` methods, record types,
  picklist dependencies, field sets, and `Schema`/describe information.
- **Triggers, validation rules & flows** — Apex triggers (before/after
  insert/update/delete/undelete), validation rules enforced on DML (raising
  `FIELD_CUSTOM_VALIDATION_EXCEPTION`), and record-triggered flows and Flow
  interviews all run alongside your Apex.
- **Governor limits** — SOQL, DML, CPU time, heap, callouts, and more are tracked
  and enforced, raising the same `LimitException` ("Too many SOQL queries", "Too
  many DML statements") you'd hit in an org.
- **Standard library** — Collections, String/Math/Date, JSON, Crypto, Pattern,
  HTTP callouts with `HttpCalloutMock`, `Messaging` email, DataWeave script
  execution, and many platform namespaces (System, Database, Schema, ConnectApi,
  EventBus, and more).
- **Testing framework** — `@IsTest`, `Test.startTest()`/`stopTest()`, mock
  callouts, test-data isolation, and code coverage (Cobertura or JSON).
- **Type checking** — running tests parse- and type-checks your code, catching
  errors before you deploy.

## Try it in your browser

Run `aer` without installing anything: the [VS Code Web Demo](https://www.octoberswimmer.com/aer-demo/)
launches a preconfigured editor with sample Apex source so you can execute tests
and step through code in the interactive debugger from your browser.

## Install

On macOS or Linux with [Homebrew](https://brew.sh):

```sh
brew install octoberswimmer/tap/aer
```

You can also install `aer` as a [Salesforce CLI plugin](https://www.npmjs.com/package/@octoberswimmer/aer-sf-plugin):

```sh
sf plugins install @octoberswimmer/aer-sf-plugin
```

Or install the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=OctoberSwimmer.aer-dap-client),
which installs `aer` for you and integrates the interactive debugger.

Otherwise:

1. Browse to the **Releases** page of this repository and download the archive
   for your platform:
- `aer_<platform>.zip` for macOS and Linux
- `aer_windows_amd64.zip` for Windows
2. Extract the archive and move the `aer` binary somewhere on your `PATH`.
- macOS/Linux: `mv aer /usr/local/bin`
- Windows (PowerShell): `Move-Item .\aer.exe $env:USERPROFILE\bin`
3. (Optional) Verify the download with the published SHA256 checksums:
- macOS/Linux: `shasum -a 256 aer_<platform>.zip`
- Windows: `Get-FileHash .\aer_windows_amd64.zip -Algorithm SHA256`

## GitHub Action

To run `aer test` in your GitHub Actions pipeline, add a workflow like:

```yaml
name: Apex Tests

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Run Apex Tests
        uses: octoberswimmer/aer-dist@main
        with:
          source: force-app
```

Adjust `with.source` for your project's Apex root, and pin the `uses:` clause to the latest released tag (for example `@v1.0.0`).

Optional inputs:
- `flags` lets you append additional CLI arguments (for example `--skip SomeTest`).
- `default-namespace` mirrors the `--default-namespace` flag to run tests against as if the code is within a package's namespace.

Set a license key for production use (running more than 100 tests).

```yaml
      - name: Run Apex Tests
        uses: octoberswimmer/aer-dist@main
        with:
          source: force-app
        env:
          AER_LICENSE_KEY: ${{ secrets.AER_LICENSE_KEY }}
```

## Quick Start

1. Initialize your project directory with the Apex source you want to run or
   test (for example an `force-app` folder from an SFDX project).
2. Execute your test suite with `aer test force-app` (add `-f NamePattern`
   to focus on specific test classes).
3. Run individual code paths with `aer exec "ClassName.methodName();" --path force-app`.
4. Use the interactive debugger to step through code, inspect variables, and
   troubleshoot issues within VS Code with `aer test --debug` or `aer exec
   --debug`.

**Learn more:**
- [Getting Started Guide](https://www.octoberswimmer.com/tools/aer/getting-started/)
- [Interactive Debugging with VS Code](https://www.octoberswimmer.com/tools/aer/docs/interactive-debugging/)
- [Interactive Debugging with IntelliJ](https://www.octoberswimmer.com/tools/aer/docs/intellij-debugging/)
- [Documentation](https://www.octoberswimmer.com/tools/aer/docs/)
- [Subscribe](https://www.octoberswimmer.com/tools/aer/subscribe/)

## Troubleshooting

- Install errors such as `cannot execute binary file`: confirm you downloaded
  the archive that matches your OS and CPU architecture.
- Command not found: ensure the directory where you installed `aer` is listed
  in your `PATH`.
- To report a bug or request a feature, open an issue in this repository.





Usage:
aer [command]

Available Commands:
cache       Inspect and clean aer's on-disk caches
completion  Generate the autocompletion script for the specified shell
doc         Show documentation for Apex standard library and user code
exec        Execute anonymous Apex code
help        Help about any command
license     Manage aer license keys
lsp         Start the Apex Language Server Protocol server
package     Manage Apex packages
server      Start a Salesforce API-compatible server
test        Run test methods in Apex source from one or more directories
upgrade     Upgrade aer to the latest version

Flags:
-h, --help            help for aer
-q, --quiet           suppress progress output
-v, --verbose count   increase verbosity (repeat for more detail)
--version         version for aer

Use "aer [command] --help" for more information about a command.


aer test --help
Run test methods in Apex source from one or more directories

Usage: aer test [directories...] [flags]

Options:

selection
--critical                   include tests marked @IsTest(critical=true); when used alone, runs only critical tests
-f, --filter strings             filter tests by name (substring match or glob pattern, can be specified multiple times)
--filter-path strings        filter tests by source file path (prefix match or glob pattern with ** support)
--for strings                run tests marked @IsTest(testFor=...) for the specified targets (can be specified multiple times)
--integration-tests          run @IntegrationTest tests (commit semantics with @TearDown) instead of @IsTest/testMethod tests; with
--watch, committed data persists across iterations like a scratch org, so rely on @TearDown for cleanup
--skip strings               exclude tests by name (substring match, applied after filter, can be specified multiple times)

configuration
-p, --assign-perms strings       assign permission sets to the default sandbox user (canonical Name or NamespacePrefix__Name, repeatable)
--certificate strings        load a PEM-encoded certificate key file; the certificate name is derived from the filename (extension
stripped; repeatable)
--certificate-dir strings    load every PEM file (.pem/.crt/.cer/.key) in a directory as certificate keys named after their filenames
(repeatable)
--certificate-key strings    associate a certificate developer name with an inline base64-encoded PEM key (format: CertName=BASE64;
e.g. the output of 'openssl base64 -A'; repeatable)
-d, --default-namespace string   treat loaded code as if it belongs to the specified namespace
--feature strings            enable optional features (PersonAccounts, HealthCloud, LiveAgent, OmniChannel, MultiCurrency,
FinancialServicesCloud, B2BCommerce, RevenueCloud, LifeSciencesCloud, ConsumerGoodsCloud,
ManufacturingCloud, Scheduler, CRMAnalytics, PrivacyCenter, ExperienceCloud, FieldService, Knowledge,
EducationCloud, HighVelocitySales, WorkplaceCommandCenter, StateAndCountryPicklist)
--package strings            package files to load (can be specified multiple times)
--package-dir strings        directories containing .pkg files to load (can be specified multiple times)
--read-only                  run tests with application read-only mode (disables DML operations)
--role string                role for the default test user; created if it does not exist
--sandbox                    set Organization.IsSandbox to true
--timezone string            default timezone for test users (e.g., America/Los_Angeles, America/Chicago)

execution
-n, --dry-run                    show tests that would be run without executing them
--runs int                   run each selected test method this many times (useful for identifying flaky tests) (default 1)
--timeout int                timeout in seconds for each test (0 = no timeout) (default 300)
--watch                      watch inputs for changes and re-run specified tests

output
--coverage string            write Apex code coverage to file
--coverage-format string     coverage output format: cobertura, json (default: auto-detect from file extension)
--json string[="-"]          write test results as JSONL (use --json or --json=FILE)
--junit string               write JUnit XML test results to file
-q, --quiet                      only output failures and summary

debugging
--all-exceptions             show details about all caught exceptions
--debug                      enable DAP debug mode
--profile file[="-"]         write Apex profiling data to file (use --profile without a file to open in Perfetto)
--trace file[="-"]           write Apex execution trace to file (use --trace without a file to open in Perfetto)

advanced
--bootstrap-db string        bootstrap SQLite database to seed before running tests
--bootstrap-tables strings   comma-separated list of tables to copy from bootstrap database (default: all tables)
--db string                  SQLite database file to use (for debugging, default: in-memory)
--faketime string            starting time for DateTime.now() and Date.today(); time advances normally from this point (RFC3339
format, e.g., 2025-10-26T18:00:00-05:00)
--no-flow-conversion         disable converting record-triggered flows to generated Apex
--skip-errors                display but skip parse, type checking, and metadata dependency errors, allowing tests to run if they
don't depend on the invalid files or metadata
--spill-to-disk string       switch per-test databases from memory to temporary on-disk files under memory pressure: auto, never, or
always (default "auto")

about
-h, --help                       help for test

Global Flags:
-v, --verbose count              increase verbosity (repeat for more detail)



FaQ:
FAQ
Why does my test fail with “No such column ‘Foo__c’ on entity ‘Bar’” when the field exists in force-app?
Custom fields are loaded into the schema, but Salesforce field-level security (FLS) still applies. By default, aer test runs as a user with the System Administrator profile, which does not automatically grant access to custom objects or custom fields. SOQL queries that reference them fail just as they would in a real org without explicit permissions.

Grant the appropriate permissions to the test user with --assign-perms:

aer test force-app --assign-perms My_Permission_Set

The argument is the developer name of a permission set in your source tree (e.g., force-app/main/default/permissionsets/My_Permission_Set.permissionset-meta.xml). The flag is repeatable; pass each permission set the suite needs:

aer test force-app \
--assign-perms My_Permission_Set \
--assign-perms Admin_Extras

For permission sets in a managed package, load the package and qualify the name with the namespace prefix:

aer test force-app \
--package mypkg.pkg \
--assign-perms mypkg__Admin

Longer term, consider updating your tests to use System.runAs to execute the tests as a user explicitly granted the necessary permissions.

Why does my multi-select picklist test pass in my org but fail in aer?
The stored order of the selections probably differs. When a record is saved, Salesforce reorders multi-select picklist selections into the order the picklist values were originally created, as described in Multi-Select Picklist Value ordering behavior. Re-ordering values in Setup changes only the order shown on records and reports; SOQL, Apex, and the API keep returning the original creation order.

aer applies the same reorder, using the order values appear in your source metadata’s value-set definition, i.e. the creation order of an org built freshly from that metadata. But creation order in a long-lived org is not exposed anywhere: retrieved metadata and describe results both report the current Setup order. If your field’s values were ever re-arranged in Setup, the order in your source metadata no longer matches the order your org stores, and aer cannot know the difference.

So a test like this can pass in your org but fail in aer (or the reverse):

My_Object__c record = new My_Object__c();
record.Colors__c = 'Green;Red';
insert record;
// Passes in an org where the Red value was created before Green; fails in
// aer if the source metadata lists Green first, because aer stores
// 'Green;Red' — its creation order for the field.
System.assertEquals('Red;Green',
[SELECT Colors__c FROM My_Object__c WHERE Id = :record.Id].Colors__c);

To write a test that passes in both, and that survives your org’s picklist history changing, don’t assert the exact string. Split the stored value and compare sets of selections instead:

My_Object__c record = new My_Object__c();
record.Colors__c = 'Green;Red';
insert record;
My_Object__c stored = [SELECT Colors__c FROM My_Object__c WHERE Id = :record.Id];
System.assertEquals(new Set<String>{'Red', 'Green'},
new Set<String>(stored.Colors__c.split(';')));

Set equality ignores order, so the assertion checks what was selected rather than the order Salesforce happened to store it in.




Start testing:
Getting Started with aer
aer lets you execute Apex tests locally without waiting on a Salesforce deploy. This guide walks through a basic project and then layers in package and data dependencies so you can reuse the same workflow across your portfolio.

Install
If you use Homebrew, install aer with:

brew install octoberswimmer/tap/aer

Otherwise, download the latest version of aer from the releases page.

Hello World
Run anonymous Apex locally with aer exec:

aer exec <<APEX
Account a = new Account(Name = 'Hello World');
insert a;
Account result = [SELECT Name FROM Account WHERE Id = :a.Id];
System.debug(result.Name);
APEX

DEBUG | Hello World

aer exec executes anonymous Apex in an in-memory environment with standard objects already available, so you can experiment with DML and SOQL without any setup or org connection.

Quick Start: Local Apex Project
Most teams keep their code in Salesforce DX (source) format under force-app/main/default. The example below uses an Apex package named ossc, but the structure matches what you see in any SFDX project:

force-app/
└── main/
└── default/
├── classes/
│   ├── Address.cls
│   ├── Address_Test.cls
│   ├── AgeService.cls
│   └── ...additional Apex classes and tests
└── objects/
└── ShipCompliant_API__c.object
└── fields/
├── CoreService_Endpoint__c.field-meta.xml
├── Password__c.field-meta.xml
└── Username__c.field-meta.xml

Run your first test sweep from the project root:

cd path/to/ossc
aer test force-app/main/default

aer test builds a schema automatically by scanning the metadata in the directories you supply. The schema lives in memory for that run, so there is nothing to clean up afterward. You can pass multiple source directories when your project splits code across several paths:

aer test force-app/main/default force-app/extra/default

Working with a legacy Metadata API layout? Point aer at the src/ directory instead—the tooling handles both formats:

# Classic metadata format
aer test src

The remaining examples use force-app/main/default for consistency. If your project still uses the classic metadata layout, substitute src in each command.

Load First-Party Packages
Many teams split shared Apex into separate repositories. If you have the source for those dependencies available locally (for example, an oslog logging package that sits next to your ShipCompliant project), convert them into packages once and reuse them across every test run:

cd path/to/ossc
mkdir -p packages

cd ../oslog

aer package create \
--output ../ossc/packages/oslog.pkg \
force-app/main/default

cd ../ossc
aer test force-app/main/default --package packages/oslog.pkg

aer package create runs inside the oslog repository and scans its metadata, so the package lines up with the source code.
Packages load straight from disk—you never need to install them in an org—which keeps integration logic intact.
Adjust the source path (../oslog/force-app/main/default) to match your dependency’s layout; point to ../oslog/src for metadata projects.
Add more packages with additional --package flags or keep everything under packages/ and point to the directory:
aer test force-app/main/default --package-dir ./packages

Load Third-Party Packages
Managed packages you cannot build locally still fit into the workflow. Use aer package mock to snapshot the metadata from an org where the package is already installed. The example below captures the dlrs namespace from a sandbox and runs tests with both first-party and third-party code:

# Export the managed package once
aer package mock dlrs \
--account your.name@example.com \
--output packages/dlrs.pkg

# Run tests with all package dependencies
aer test force-app/main/default \
--package packages/oslog.pkg \
--package packages/dlrs.pkg

Want a deeper walkthrough? See Mock Managed Package Classes → for a step-by-step example that stubs oslog.Log inside a mocked package.

When you have several .pkg files, place them in a shared folder and load them in bulk:

aer test force-app/main/default --package-dir ./packages

Each package executes in its own namespace, so components do not conflict unless two archives target the same namespace. Loading multiple packages for a single namespace is not supported today. .pkg files are binary, but they can still be checked into source control so your CI environment can reuse them. The --account flag accepts usernames from both the Force CLI and the newer sf/sfdx authentication stores—use whichever tool already has a session for your sandbox.

Bring In Setup Data
Some tests require seed data such as OrgWideEmailAddress records or reference tables that are not stored in source. aer supports two approaches: point tests at a SQLite database that already contains the records you need, or generate that database on demand and keep it in sync with your org.

Seed from an external SQLite snapshot
When you want to pull in records maintained outside of aer, use --bootstrap-db to copy data from another SQLite file into the test database before execution. For example, capture the OrgWideEmailAddress table with the ro CLI and hand it to aer:

ro -D bootstrap.db OrgWideEmailAddress

aer test force-app/main/default \
--bootstrap-db bootstrap.db \
--bootstrap-tables OrgWideEmailAddress

Leave --bootstrap-tables unset to copy every table from the bootstrap database, or repeat --bootstrap-tables for each table you want to include. The bootstrap file is read-only; aer copies the data into its own in-memory database and never modifies the source file.

With packages and data dialed in, aer delivers production-faithful Apex tests that run in seconds on your laptop. Extend the setup as your dependencies grow, check in the configuration, and the whole team—including CI—benefits from fast, dependable feedback.





