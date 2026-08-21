import {
  ApexClassNotFoundError,
  ApexClassValidator,
} from '../../../src/service/apexClassValidator.js'
import { fakeSourceProvider } from '../../utils/testUtil.js'

describe('ApexClassValidator', () => {
  let sut: ApexClassValidator
  let source: ReturnType<typeof fakeSourceProvider>
  const params = {
    apexClassName: 'TestClass',
    apexTestClassNames: ['TestClassTest'],
    reportDir: 'reports',
  }

  beforeEach(() => {
    // Arrange
    source = fakeSourceProvider()
    sut = new ApexClassValidator(source)
  })

  describe('validate', () => {
    it('should reject with an ApexClassNotFoundError carrying the class name when the class under mutation does not exist', async () => {
      // Arrange
      source.classExists.mockResolvedValueOnce(false)

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toBeInstanceOf(ApexClassNotFoundError)
      await expect(result).rejects.toMatchObject({
        className: 'TestClass',
        name: 'ApexClassNotFoundError',
      })
    })

    it('should reject with a developer-facing message naming the class', async () => {
      // Arrange
      source.classExists.mockResolvedValueOnce(false)

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toMatchObject({
        message: "Apex class 'TestClass' not found",
      })
    })

    it('should resolve and check existence exactly once when the class under mutation exists', async () => {
      // Arrange
      source.classExists.mockResolvedValueOnce(true)

      // Act
      await expect(sut.validate(params)).resolves.not.toThrow()

      // Assert
      expect(source.classExists).toHaveBeenCalledTimes(1)
      expect(source.classExists).toHaveBeenCalledWith('TestClass')
    })
  })

  describe('assessPerimeter', () => {
    it('should delegate to the source and resolve with both its verdicts and its resolutions', async () => {
      // Arrange
      const assessment = {
        skipped: [{ className: 'TestClassTest', reason: 'not-found' as const }],
        resolutions: [
          {
            classId: '01p000000000001',
            displayName: 'TestClassTest',
            lookupKeys: ['testclasstest'],
          },
        ],
      }
      source.assessPerimeter.mockResolvedValueOnce(assessment)

      // Act
      const result = await sut.assessPerimeter(params.apexTestClassNames)

      // Assert
      expect(result).toEqual(assessment)
      expect(source.assessPerimeter).toHaveBeenCalledWith(
        params.apexTestClassNames
      )
    })

    it('should propagate a rejecting source untouched', async () => {
      // Arrange
      const failure = new Error('org unavailable')
      source.assessPerimeter.mockRejectedValueOnce(failure)

      // Act & Assert
      await expect(
        sut.assessPerimeter(params.apexTestClassNames)
      ).rejects.toThrow('org unavailable')
    })
  })
})
