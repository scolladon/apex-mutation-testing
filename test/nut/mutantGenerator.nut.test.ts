import { describe, expect, it } from '@jest/globals'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'

describe('MutantGenerator NUT - non-numeric type filtering', () => {
  describe('Given an Apex class with a catch clause variable (issue #108)', () => {
    it('Then should NOT generate UOI mutations for the Exception catch parameter', async () => {
      // Arrange
      const code = `
public class AuraExceptionExample {
  public void handleException() {
    try {
      doSomething();
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }
}
`
      const typeRegistry = await new TypeDiscoverer().analyze(code)
      const coveredLines = new Set([7]) // throw new AuraHandledException(e.getMessage())

      // Act
      const sut = new MutantGenerator()
      const mutations = sut.compute(code, coveredLines, typeRegistry)

      // Assert
      const uoiMutations = mutations.filter(
        m => m.mutationName === 'UnaryOperatorInsertionMutator'
      )
      expect(uoiMutations).toHaveLength(0)
    })
  })
})
