import { readFileSync } from 'node:fs'

// Resolved relative to this file, not the cwd: read from elsewhere, a manifest with no
// `dependencies` would otherwise report success and the gate would enforce nothing.
const MANIFEST = new URL('../package.json', import.meta.url)
const EXACT_SEMVER =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

// Every manifest key a consumer installs at runtime. `devDependencies` and
// `peerDependencies` are excluded deliberately: they keep their ranges.
const PINNED_SECTIONS = ['dependencies', 'optionalDependencies']

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

if (manifest.dependencies === undefined) {
  process.stderr.write(
    'package.json has no dependencies section - refusing to report a pinned tree.\n'
  )
  process.exitCode = 1
} else {
  const offenders = PINNED_SECTIONS.flatMap(section =>
    Object.entries(manifest[section] ?? {})
      .filter(([, requirement]) => !EXACT_SEMVER.test(requirement))
      .map(([name, requirement]) => `  ${section}.${name}: ${requirement}`)
  )

  if (offenders.length > 0) {
    process.stderr.write(
      `package.json runtime dependencies must be pinned to exact versions:\n${offenders.join('\n')}\n` +
        'Replace each range with the version npm resolved (npm ls --depth=0).\n' +
        'Aliases (npm:pkg@1.2.3) and =-prefixed versions must be written as bare exact versions.\n'
    )
    // Not process.exit: stderr to a pipe is asynchronous, and exiting here truncates
    // the offender list exactly where it is read from a CI log.
    process.exitCode = 1
  } else {
    const pinned = PINNED_SECTIONS.reduce(
      (total, section) => total + Object.keys(manifest[section] ?? {}).length,
      0
    )
    console.log(`runtime dependencies: ${pinned} pinned`)
  }
}
