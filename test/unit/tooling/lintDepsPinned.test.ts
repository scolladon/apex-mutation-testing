import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REAL_SCRIPT = fileURLToPath(
  new URL('../../../tooling/lint-deps-pinned.mjs', import.meta.url)
)

describe('lint-deps-pinned', () => {
  let sut: string
  let workspace: string

  const runAgainst = (manifest: unknown) => {
    // Arrange — the script resolves its manifest relative to its own location, so the
    // fixture mirrors the real layout: tooling/<script> beside a sibling package.json.
    writeFileSync(join(workspace, 'package.json'), JSON.stringify(manifest))
    // Act
    return spawnSync('node', [sut], { encoding: 'utf8' })
  }

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'lint-deps-pinned-'))
    mkdirSync(join(workspace, 'tooling'))
    sut = join(workspace, 'tooling', 'lint-deps-pinned.mjs')
    copyFileSync(REAL_SCRIPT, sut)
  })

  afterEach(() => {
    rmSync(workspace, { force: true, recursive: true })
  })

  it('Given every runtime dependency is an exact version, When the gate runs, Then it passes', () => {
    // Arrange & Act
    const result = runAgainst({
      dependencies: { '@oclif/core': '4.13.3', antlr4ts: '0.5.0-alpha.4' },
      devDependencies: { vitest: '^4.1.10' },
    })

    // Assert
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('2 pinned')
  })

  it('Given a ranged runtime dependency, When the gate runs, Then it fails and names the offender', () => {
    // Arrange & Act
    const result = runAgainst({
      dependencies: { '@oclif/core': '^4.13.3', antlr4ts: '0.5.0-alpha.4' },
    })

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dependencies.@oclif/core: ^4.13.3')
    expect(result.stderr).not.toContain('antlr4ts')
  })

  it('Given a ranged optional dependency, When the gate runs, Then it fails', () => {
    // Arrange & Act
    const result = runAgainst({
      dependencies: { '@oclif/core': '4.13.3' },
      optionalDependencies: { fsevents: '~2.3.3' },
    })

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('optionalDependencies.fsevents: ~2.3.3')
  })

  it('Given a ranged dev dependency, When the gate runs, Then it is ignored', () => {
    // Arrange & Act
    const result = runAgainst({
      dependencies: { '@oclif/core': '4.13.3' },
      devDependencies: { vitest: '^4.1.10', typescript: '>=7' },
    })

    // Assert
    expect(result.status).toBe(0)
  })

  it('Given no dependencies section, When the gate runs, Then it refuses rather than reporting success', () => {
    // Arrange & Act
    const result = runAgainst({ devDependencies: { vitest: '^4.1.10' } })

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('no dependencies section')
  })
})
