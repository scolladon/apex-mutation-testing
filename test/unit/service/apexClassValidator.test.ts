import {
  ApexClassAmbiguousError,
  ApexClassNotFoundError,
  ApexClassNotMutableError,
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
    it('should resolve and assess the target class exactly once when the verdict is mutable', async () => {
      // Arrange
      vi.mocked(source.assessTargetClass).mockResolvedValueOnce({
        kind: 'mutable',
      })

      // Act
      await expect(sut.validate(params)).resolves.not.toThrow()

      // Assert
      expect(source.assessTargetClass).toHaveBeenCalledTimes(1)
      expect(source.assessTargetClass).toHaveBeenCalledWith('TestClass')
    })

    it('should reject with an ApexClassNotFoundError carrying the class name when the verdict is not-found', async () => {
      // Arrange
      vi.mocked(source.assessTargetClass).mockResolvedValueOnce({
        kind: 'not-found',
      })

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toBeInstanceOf(ApexClassNotFoundError)
      await expect(result).rejects.toMatchObject({
        className: 'TestClass',
        name: 'ApexClassNotFoundError',
      })
    })

    it('should reject with an ApexClassNotMutableError carrying the class name and states when the verdict is not-mutable', async () => {
      // Arrange
      vi.mocked(source.assessTargetClass).mockResolvedValueOnce({
        kind: 'not-mutable',
        states: ['installed'],
      })

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toBeInstanceOf(ApexClassNotMutableError)
      await expect(result).rejects.toMatchObject({
        className: 'TestClass',
        states: ['installed'],
        name: 'ApexClassNotMutableError',
      })
    })

    it('should reject with an ApexClassAmbiguousError carrying the class name and spellings when the verdict is ambiguous', async () => {
      // Arrange
      vi.mocked(source.assessTargetClass).mockResolvedValueOnce({
        kind: 'ambiguous',
        spellings: ['mockery.Argument', 'acme.Argument'],
      })

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toBeInstanceOf(ApexClassAmbiguousError)
      await expect(result).rejects.toMatchObject({
        className: 'TestClass',
        spellings: ['mockery.Argument', 'acme.Argument'],
        name: 'ApexClassAmbiguousError',
      })
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
