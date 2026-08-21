import {
  type ApexClassCandidate,
  isMutableApexClass,
  selectMutableClass,
} from '../../../../src/adapter/org/apexClassMutability.js'

describe('apexClassMutability', () => {
  describe('isMutableApexClass', () => {
    it.each([
      ['unmanaged', true],
      ['installedEditable', true],
      ['beta', true],
      ['released', true],
      ['deprecated', true],
      ['deprecatedEditable', true],
      ['installed', false],
      ['deleted', false],
      [null, false],
      ['somethingNew', false],
      ['Unmanaged', false],
    ])(
      'Given ManageableState %s, When isMutableApexClass, Then returns %s',
      (state, expected) => {
        // Arrange
        const sut = { ManageableState: state }

        // Act
        const result = isMutableApexClass(sut)

        // Assert
        expect(result).toBe(expected)
      }
    )
  })

  describe('selectMutableClass', () => {
    it('Given no candidates, When selectMutableClass, Then returns not-found', () => {
      // Arrange
      const sut: ApexClassCandidate[] = []

      // Act
      const result = selectMutableClass(sut, null)

      // Assert
      expect(result).toEqual({ kind: 'not-found' })
    })

    it('Given a single non-mutable candidate, When selectMutableClass, Then returns not-mutable carrying that one candidate', () => {
      // Arrange
      const sut: ApexClassCandidate[] = [
        { NamespacePrefix: 'devedapp', ManageableState: 'installed' },
      ]

      // Act
      const result = selectMutableClass(sut, 'namespaced')

      // Assert
      expect(result).toEqual({ kind: 'not-mutable', candidates: sut })
      expect(result.kind === 'not-mutable' && result.candidates).toHaveLength(1)
    })

    it('Given two non-mutable candidates in different namespaces, When selectMutableClass, Then returns not-mutable carrying both candidates', () => {
      // Arrange
      const sut: ApexClassCandidate[] = [
        { NamespacePrefix: 'devedapp', ManageableState: 'installed' },
        { NamespacePrefix: 'other', ManageableState: 'deleted' },
      ]

      // Act
      const result = selectMutableClass(sut, 'namespaced')

      // Assert
      expect(result).toEqual({ kind: 'not-mutable', candidates: sut })
      expect(result.kind === 'not-mutable' && result.candidates).toHaveLength(2)
    })

    it('Given a foreign mutable candidate listed before the own-namespace mutable candidate, When selectMutableClass, Then prefers the own-namespace candidate', () => {
      // Arrange — foreign candidate first: a fixture with own-namespace first
      // could not distinguish "prefer own namespace" from "prefer [0]".
      const foreign = {
        NamespacePrefix: 'mockery',
        ManageableState: 'installedEditable',
      }
      const own = {
        NamespacePrefix: null,
        ManageableState: 'installedEditable',
      }
      const sut: ApexClassCandidate[] = [foreign, own]

      // Act
      const result = selectMutableClass(sut, null)

      // Assert
      expect(result).toEqual({ kind: 'mutable', candidate: own })
    })

    it('Given exactly one mutable candidate and no own-namespace match, When selectMutableClass, Then returns that unique mutable candidate', () => {
      // Arrange
      const mutable = {
        NamespacePrefix: 'mockery',
        ManageableState: 'installedEditable',
      }
      const notMutable = {
        NamespacePrefix: 'devedapp',
        ManageableState: 'installed',
      }
      const sut: ApexClassCandidate[] = [mutable, notMutable]

      // Act
      const result = selectMutableClass(sut, 'namespaced')

      // Assert
      expect(result).toEqual({ kind: 'mutable', candidate: mutable })
    })

    it('Given two mutable candidates in foreign namespaces with no own-namespace match, When selectMutableClass, Then returns ambiguous carrying both competing candidates', () => {
      // Arrange
      const first = {
        NamespacePrefix: 'mockery',
        ManageableState: 'installedEditable',
      }
      const second = {
        NamespacePrefix: 'acme',
        ManageableState: 'installedEditable',
      }
      const sut: ApexClassCandidate[] = [first, second]

      // Act
      const result = selectMutableClass(sut, 'namespaced')

      // Assert
      expect(result).toEqual({
        kind: 'ambiguous',
        candidates: [first, second],
      })
    })

    it('Given the own-namespace candidate spelled in a different case, When selectMutableClass, Then still prefers it over a foreign mutable candidate', () => {
      // Arrange
      const own = {
        NamespacePrefix: 'MOCKERY',
        ManageableState: 'installedEditable',
      }
      const foreign = {
        NamespacePrefix: 'acme',
        ManageableState: 'installedEditable',
      }
      const sut: ApexClassCandidate[] = [own, foreign]

      // Act
      const result = selectMutableClass(sut, 'mockery')

      // Assert
      expect(result).toEqual({ kind: 'mutable', candidate: own })
    })

    it('Given a candidate with an empty-string namespace in a non-namespaced org, When selectMutableClass, Then treats it as own-namespace and returns it as mutable', () => {
      // Arrange
      const sut: ApexClassCandidate[] = [
        { NamespacePrefix: '', ManageableState: 'installedEditable' },
      ]

      // Act
      const result = selectMutableClass(sut, null)

      // Assert
      expect(result).toEqual({ kind: 'mutable', candidate: sut[0] })
    })
  })
})
