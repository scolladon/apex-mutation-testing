import type { MetadataComponentDependency } from '../../../../src/adapter/org/MetadataComponentDependency.js'
import { toApexClassTypeName } from '../../../../src/adapter/org/orgTypeNames.js'

describe('orgTypeNames', () => {
  describe('toApexClassTypeName', () => {
    it('Given a non-namespaced org and a dependency with no namespace, When toApexClassTypeName, Then aliases carries the bare name only once', () => {
      // Arrange — both sides fold to null, so isOwnNamespace agrees with
      // itself: skipping the no-namespace early return would fall through
      // into the own-namespace branch and duplicate the bare name instead
      // of returning it once.
      const dep: MetadataComponentDependency = {
        Id: 'dep1',
        RefMetadataComponentType: 'ApexClass',
        RefMetadataComponentName: 'MyHelper',
        RefMetadataComponentNamespace: null,
      }

      // Act
      const result = toApexClassTypeName(dep, null)

      // Assert
      expect(result).toEqual({ apiName: 'MyHelper', aliases: ['MyHelper'] })
    })
  })
})
