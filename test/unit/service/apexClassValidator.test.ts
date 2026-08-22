import {
  ApexClassAmbiguousError,
  ApexClassNotFoundError,
  ApexClassNotMutableError,
  ApexClassUnqualifiedError,
} from '../../../src/port/apexClassErrors.js'
import { ApexClassValidator } from '../../../src/service/apexClassValidator.js'
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

    it('should reject with an ApexClassUnqualifiedError carrying the class name and the qualified spelling when the verdict is unqualified', async () => {
      // Arrange
      vi.mocked(source.assessTargetClass).mockResolvedValueOnce({
        kind: 'unqualified',
        spelling: 'mockery.Argument',
      })

      // Act
      const result = sut.validate(params)

      // Assert
      await expect(result).rejects.toBeInstanceOf(ApexClassUnqualifiedError)
      await expect(result).rejects.toMatchObject({
        className: 'TestClass',
        spelling: 'mockery.Argument',
        name: 'ApexClassUnqualifiedError',
      })
    })

    it('should keep the org-supplied spelling off the raw error message, matching its ApexClassNotMutableError/ApexClassAmbiguousError siblings', async () => {
      // Arrange — spelling embeds NamespacePrefix, org-supplied text
      // unconstrained by any grammar. The raw .message is a terminal sink
      // on the readClass/TOCTOU path (see orgApexSourceProvider.ts), which
      // bypasses run.ts's sanitizeForDisplay rendering — so the field, not
      // the message, must carry it.
      vi.mocked(source.assessTargetClass).mockResolvedValueOnce({
        kind: 'unqualified',
        spelling: 'mockery.Argument',
      })

      // Act
      const error = await sut
        .validate(params)
        .catch((rejection: unknown) => rejection)

      // Assert
      expect((error as Error).message).toBe(
        "Apex class 'TestClass' is modifiable on this org only under its namespace-qualified spelling"
      )
      expect((error as Error).message).not.toContain('mockery.Argument')
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
