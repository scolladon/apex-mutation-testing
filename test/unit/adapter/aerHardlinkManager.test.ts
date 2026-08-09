import { copyFile, link, mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AerHardlinkManager } from '../../../src/adapter/aerHardlinkManager.js'

vi.mock('node:fs/promises')

describe('AerHardlinkManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.mocked(mkdir).mockResolvedValue(undefined as never)
  })

  it('should mirror directory using hardlinks for general files and hardcopy for the class under test', async () => {
    // Arrange
    const manager = new AerHardlinkManager(join('/tmp', '.temp', 'aer-hardlink'))
    const sourceDir = '/project/force-app'
    const apexClassName = 'LeadRequestController'

    vi.mocked(readdir).mockResolvedValueOnce([
      { name: 'LeadRequestController.cls', isDirectory: () => false, isFile: () => true },
      { name: 'LeadRequestTest.cls', isDirectory: () => false, isFile: () => true },
      { name: 'subdir', isDirectory: () => true, isFile: () => false },
    ] as never)

    vi.mocked(readdir).mockResolvedValueOnce([
      { name: 'Helper.cls', isDirectory: () => false, isFile: () => true },
    ] as never)

    vi.mocked(copyFile).mockResolvedValue(undefined)
    vi.mocked(link).mockResolvedValue(undefined)

    // Act
    const targetDir = await manager.prepareMirror(sourceDir, apexClassName)

    // Assert
    expect(targetDir).toBe(resolve(join('/tmp', '.temp', 'aer-hardlink')))
    
    // Class under test must be copied (hardcopy)
    expect(copyFile).toHaveBeenCalledWith(
      resolve('/project/force-app/LeadRequestController.cls'),
      resolve(join(targetDir, 'LeadRequestController.cls'))
    )

    // Other files must be hardlinked
    expect(link).toHaveBeenCalledWith(
      resolve('/project/force-app/LeadRequestTest.cls'),
      resolve(join(targetDir, 'LeadRequestTest.cls'))
    )
    expect(link).toHaveBeenCalledWith(
      resolve('/project/force-app/subdir/Helper.cls'),
      resolve(join(targetDir, 'subdir/Helper.cls'))
    )
  })

  it('should cleanup the mirrored target directory', async () => {
    // Arrange
    const manager = new AerHardlinkManager(join('/tmp', '.temp', 'aer-hardlink'))

    // Act
    await manager.cleanup()

    // Assert
    expect(rm).toHaveBeenCalledWith(
      resolve(join('/tmp', '.temp', 'aer-hardlink')),
      { recursive: true, force: true }
    )
  })
})
