# Contributing to apex-mutation-testing

We encourage the developer community to contribute to this repository. This guide has instructions to install, build, test and contribute to the framework.

- [Requirements](#requirements)
- [Installation](#installation)
- [Testing](#testing)
- [Git Workflow](#git-workflow)

## Requirements

- [Node](https://nodejs.org/) >= 22.22 (supported: 22, 24, 26)
- [npm](https://www.npmjs.com/) >= 10.9.0

## Installation

### 1) Download the repository

```bash
git clone git@github.com:scolladon/apex-mutation-testing.git
```

### 2) Install Dependencies

This will install all the tools needed to contribute

```bash
npm install
```

### 3) Build application

```bash
npm pack
```

Rebuild every time you made a change in the source and you need to test locally

## Testing

### Unit Testing

When developing, use [vitest](https://vitest.dev/) unit testing to provide test coverage for new functionality. To run the vitest tests use the following command from the root directory:

```bash
# just run test
npm run test:unit
```

To execute a particular test file or run tests matching a pattern, use the following commands:

```bash
# run a single test file
npx vitest run test/unit/path/to/file.test.ts

# run tests matching a pattern
npx vitest run -t "pattern"
```

### NUT Testing

When developing, use Vitest NUT tests to provide command-level functional coverage with a mocked org. To run the NUT tests use the following command from the root directory:

```bash
# run test
npm run test:nut
```

### E2E Testing

E2E tests run the full mutation testing pipeline against a real Salesforce org, produce an HTML report, and validate the output against a committed snapshot (`test/e2e/index.html`).

```bash
# Run locally (uses node ./bin/run.js + apex-mutation-testing org)
npm run test:e2e:run:local

# Validate snapshot matches
npm run test:e2e:validate
```

The validation step uses `git diff --quiet test/e2e/` — any difference from the committed snapshot fails the check.

#### Known Flaky Mutant

The `MemberVariableMutator` mutation on `String label = ''` (line 2 of `Mutation.cls`) is non-deterministic. The Salesforce org sometimes returns `CompileError` and sometimes `Survived` for this mutation. The committed snapshot uses `Survived` as the stable baseline. If the e2e CI job fails only on this entry, re-run the job.

## Editor Configurations

Configure your editor to use our lint and code style rules.

### Code formatting

[Biome](https://biomejs.dev/) Format, lint, and more in a fraction of a second.

### Code linting

[Biome](https://biomejs.dev/) Format, lint, and more in a fraction of a second.

### Commit linting

This repository uses [Commitlint](https://github.com/conventional-changelog/commitlint) to check our commit convention.
Pre-commit git hook using husky and pull request check both the commit convention for each commit in a branch.

You can use an interactive command line to help you create supported commit message

```bash
npm run commit
```

### Engine linting

This repository uses [ls-engines](https://github.com/ljharb/ls-engines) to verify the running Node version is within the supported range and that `engines.node` stays consistent with the dependency graph.
It runs as a blocking pre-push git hook and as a pull request check.

### Dependency policy

This repository is kept aligned with its three sibling plugins (`sfdx-git-delta`,
`apex-mutation-testing`, `sf-git-merge-driver`, `dataset-loader`), so the rules below are
identical in all four.

- **Every dependency is pinned exactly** — runtime and dev alike. No `^`, no `~`, no ranges.
  A range in a runtime dependency becomes non-determinism for consumers, and a range in a dev
  dependency becomes drift between the four repositories.
- **`.npmrc` sets `save-exact=true`**, so `npm install <package>` records an exact version by
  default. This is the only mechanism enforcing the rule — keep the file. `save-exact` cannot
  be expressed in `package.json`: npm reads it from `.npmrc` or the `npm_config_save_exact`
  environment variable, and `publishConfig` applies at publish time only.
- **Pins track current latest.** Dependabot moves them; its `versioning-strategy: increase`
  raises a pinned requirement in place rather than widening it, so grouped updates stay exact.
- **npm 12 is required** (`engines.npm: ">=12"`), and **no shrinkwrap is shipped**. npm 12
  excludes `npm-shrinkwrap.json` from `npm pack` even when it is listed in `files`, silently
  and with exit 0, so the mechanism is inert rather than merely unused.
- **There is deliberately no lint for this.** `npm outdated` runs as a blocking check in CI
  and catches a pin that has fallen behind latest, but it cannot see a range that still
  resolves to latest. Adding a hand-edited range is caught in review, not by tooling.

What the pinning does and does not buy: it caps only the direct dependencies a consumer
resolves. The transitive majority still floats, and capping those would mean declaring the
whole chain directly.


### PR linting

When a PR is ready for merge we use the PR name to create the squash and merge commit message.
We use the commit convention to auto-generate the content and the type of each release
It needs to follow our commit lint convention and it will be check at the PR level

## Git Workflow

The process of submitting a pull request is straightforward and
generally follows the same pattern each time:

1. [Fork the repo](#fork-the-repo)
2. [Create a feature branch](#create-a-feature-branch)
3. [Make your changes](#make-your-changes)
4. [Rebase](#rebase)
5. [Check your submission](#check-your-submission)
6. [Create a pull request](#create-a-pull-request)
7. [Update the pull request](#update-the-pull-request)

### Fork the repo

[Fork](https://help.github.com/en/articles/fork-a-repo) the [scolladon/apex-mutation-testing](https://github.com/scolladon/apex-mutation-testing) repo. Clone your fork in your local workspace and [configure](https://help.github.com/en/articles/configuring-a-remote-for-a-fork) your remote repository settings.

```bash
git clone git@github.com:<YOUR-USERNAME>/apex-mutation-testing.git
cd apex-mutation-testing
git remote add upstream git@github.com:scolladon/apex-mutation-testing.git
```

### Create a feature branch

```bash
git checkout main
git pull origin main
git checkout -b feature/<name-of-the-feature>
```

### Make your changes

Change the files, build, test, lint and commit your code using the following command:

```bash
git add <path/to/file/to/commit>
git commit ...
git push origin feature/<name-of-the-feature>
```

Commit your changes using a descriptive commit message

The above commands will commit the files into your feature branch. You can keep
pushing new changes into the same branch until you are ready to create a pull
request.

### Rebase

Sometimes your feature branch will get stale on the main branch,
and it will must a rebase. Do not use the github UI rebase to keep your commits signed. The following steps can help:

```bash
git checkout main
git pull upstream main
git checkout feature/<name-of-the-feature>
git rebase upstream/main
```

_note: If no conflicts arise, these commands will apply your changes on top of the main branch. Resolve any conflicts._

### Check your submission

#### Lint your changes

```bash
npm run lint
```

The above command may display lint issues not related to your changes.
The recommended way to avoid lint issues is to [configure your
editor](https://biomejs.dev/guides/integrate-in-vcs/) to warn you in real time as you edit the file.

the plugin lint all those things :

- typescript files
- folder structure
- plugin parameters
- plugin output
- dependencies
- dead code / configuration

Fixing all existing lint issues is a tedious task so please pitch in by fixing
the ones related to the files you make changes to!

#### Run tests

Test your change by running the unit tests and integration tests. See the [testing instructions](#testing).

### Create a pull request

If you've never created a pull request before, follow [these
instructions](https://help.github.com/articles/creating-a-pull-request/). See [pull request samples](https://github.com/scolladon/sfdx-git-delta/pulls)

### Update the pull request

```bash
git fetch origin
git rebase origin/${base_branch}

# Then force push it
git push origin ${feature_branch} --force-with-lease
```

_note: If your pull request needs more changes, keep working on your feature branch as described above._

CI validates prettifying, linting and tests

### Collaborate on the pull request

We use [Conventional Comments](https://conventionalcomments.org/) to ensure every comment expresses the intention and is easy to understand.
Pull Request comments are not enforced, it is more a way to help the reviewers and contributors to collaborate on the pull request.

## CLI parameters convention

The plugins uses [sf cli parameters convention](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags) to define parameters for the CLI.

## Testing the plugin from a pull request

Every pull request — including one opened from a fork — publishes a preview build of the plugin
to [pkg.pr.new](https://pkg.pr.new). A bot comment on the pull request carries the exact install
command:

```sh
sf plugins install https://pkg.pr.new/apex-mutation-testing@<commit>
```

Previews are addressed by commit, not by pull request: each push produces a new URL, so read
the install command again rather than re-running an earlier one. Preview builds are removed
once they have gone a month without a download, and after six months in any case — reinstall
from a fresh comment if an old link stops resolving.

A preview from a fork is unreviewed contributor code, and installing a plugin executes arbitrary
code with your Salesforce org credentials in reach. Install those only in a disposable
environment. Fork pull requests get no comment — their token is read-only — so the URL must be
read from the `preview` job's log.

Previews publish only once the [pkg-pr-new GitHub App](https://github.com/apps/pkg-pr-new) is
installed on the repository. Without it the preview job fails with a self-describing 404.

To go back to the released plugin:

```sh
sf plugins uninstall apex-mutation-testing
sf plugins install apex-mutation-testing@latest-rc
```
