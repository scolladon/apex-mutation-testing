import { copyFile, link, mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export class AerHardlinkManager {
  private readonly targetDir: string

  constructor(targetDir = join(process.cwd(), '.temp', 'aer-hardlink')) {
    this.targetDir = resolve(targetDir)
  }

  public getTargetDir(): string {
    return this.targetDir
  }

  /**
   * Mirrors sourceDir to .temp/aer-hardlink using hardlinks for all files,
   * EXCEPT the apexClassName file which is copied as an independent hardcopy.
   */
  public async prepareMirror(
    sourceDir: string,
    apexClassName: string
  ): Promise<string> {
    const resolvedSource = resolve(sourceDir)

    // Ensure clean target directory
    await this.cleanup()
    await mkdir(this.targetDir, { recursive: true })

    await this.mirrorDirectory(resolvedSource, this.targetDir, apexClassName)
    return this.targetDir
  }

  private async mirrorDirectory(
    srcDir: string,
    destDir: string,
    apexClassName: string
  ): Promise<void> {
    const entries = await readdir(srcDir, { withFileTypes: true })
    const targetFileName = `${apexClassName.toLowerCase()}.cls`

    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name)
      const destPath = join(destDir, entry.name)

      if (entry.isDirectory()) {
        await mkdir(destPath, { recursive: true })
        await this.mirrorDirectory(srcPath, destPath, apexClassName)
      } else if (entry.isFile()) {
        if (entry.name.toLowerCase() === targetFileName) {
          // Apex class under test must be a hardcopy (independent file copy)
          // so mutations do not affect the original source repository.
          await copyFile(srcPath, destPath)
        } else {
          // Hardlink for all other files
          try {
            await link(srcPath, destPath)
          } catch {
            // Fallback to copy if hardlinking fails
            await copyFile(srcPath, destPath)
          }
        }
      }
    }
  }

  /**
   * Removes the mirrored hardlink directory.
   */
  public async cleanup(): Promise<void> {
    try {
      await rm(this.targetDir, { recursive: true, force: true })
    } catch {
      // Non-fatal if already cleaned up
    }
  }
}
