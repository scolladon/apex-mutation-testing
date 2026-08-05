import { readFileSync } from 'node:fs'

const MANIFEST = 'package.json'
const EXACT_SEMVER =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const { dependencies = {} } = JSON.parse(readFileSync(MANIFEST, 'utf8'))

const ranged = Object.entries(dependencies).filter(
  ([, requirement]) => !EXACT_SEMVER.test(requirement)
)

if (ranged.length > 0) {
  const offenders = ranged
    .map(([name, requirement]) => `  ${name}: ${requirement}`)
    .join('\n')
  process.stderr.write(
    `${MANIFEST} dependencies must be pinned to exact versions:\n${offenders}\n` +
      'Replace each range with the version npm resolved (npm ls --depth=0).\n'
  )
  process.exit(1)
}

console.log(`dependencies: ${Object.keys(dependencies).length} pinned`)
