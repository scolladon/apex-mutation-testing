import {
  bareApexClassName,
  splitApexClassName,
} from '../../../src/type/ApexClassName.js'

describe('ApexClassName', () => {
  describe('splitApexClassName', () => {
    it.each([
      ['Argument', { namespace: null, name: 'Argument' }],
      ['mockery.Argument', { namespace: 'mockery', name: 'Argument' }],
    ])(
      'Given spelling %s, When splitApexClassName, Then returns %s',
      (spelling, expected) => {
        // Arrange
        const sut = spelling

        // Act
        const result = splitApexClassName(sut)

        // Assert
        expect(result).toEqual(expected)
      }
    )
  })

  describe('bareApexClassName', () => {
    it('Given a dotted spelling, When bareApexClassName, Then returns the name segment only', () => {
      // Arrange
      const sut = 'mockery.Argument'

      // Act
      const result = bareApexClassName(sut)

      // Assert
      expect(result).toBe('Argument')
    })

    it('Given a bare spelling, When bareApexClassName, Then returns it unchanged', () => {
      // Arrange
      const sut = 'Argument'

      // Act
      const result = bareApexClassName(sut)

      // Assert
      expect(result).toBe('Argument')
    })
  })
})
