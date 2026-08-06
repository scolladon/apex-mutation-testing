import {
  qualifyTestMethod,
  testClassOf,
  testMethodOf,
  toTestItems,
} from '../../../src/type/TestMethodId.js'

describe('TestMethodId', () => {
  describe('qualifyTestMethod', () => {
    it.each([
      ['FooTest', 'testA', 'FooTest.testA'],
      ['ns.FooTest', 'testA', 'ns.FooTest.testA'],
    ])(
      'Given class %s and method %s, When qualifyTestMethod, Then joins them with a dot',
      (className, methodName, expected) => {
        // Act
        const result = qualifyTestMethod(className, methodName)

        // Assert
        expect(result).toBe(expected)
      }
    )
  })

  describe('testClassOf / testMethodOf', () => {
    it('Given a namespaced qualified id, When testClassOf, Then splits on the LAST dot', () => {
      // Arrange
      const sut = 'ns.FooTest.testA'

      // Act
      const result = testClassOf(sut)

      // Assert
      expect(result).toBe('ns.FooTest')
    })

    it('Given a namespaced qualified id, When testMethodOf, Then splits on the LAST dot', () => {
      // Arrange
      const sut = 'ns.FooTest.testA'

      // Act
      const result = testMethodOf(sut)

      // Assert
      expect(result).toBe('testA')
    })

    it('Given a bare qualified id, When testClassOf, Then returns the class name', () => {
      // Arrange
      const sut = 'FooTest.testA'

      // Act
      const result = testClassOf(sut)

      // Assert
      expect(result).toBe('FooTest')
    })
  })

  describe('round-trip property lens', () => {
    it('Given a map of bare and namespaced classes to method sets, When qualified then folded back through toTestItems, Then reproduces the input exactly', () => {
      // Arrange
      const fixture = new Map<string, Set<string>>([
        ['FooTest', new Set(['testA', 'testB'])],
        ['ns.BarTest', new Set(['testA'])],
      ])
      const ids = [...fixture].flatMap(([className, methods]) =>
        [...methods].map(methodName => qualifyTestMethod(className, methodName))
      )

      // Act
      const result = toTestItems(ids)

      // Assert
      expect(result).toEqual([
        { className: 'FooTest', testMethods: ['testA', 'testB'] },
        { className: 'ns.BarTest', testMethods: ['testA'] },
      ])
    })
  })

  describe('toTestItems grouping', () => {
    it('Given interleaved ids across classes, When toTestItems, Then groups by class preserving first-seen class and method order', () => {
      // Arrange
      const ids = [
        qualifyTestMethod('A', 'a'),
        qualifyTestMethod('B', 'a'),
        qualifyTestMethod('A', 'b'),
      ]

      // Act
      const result = toTestItems(ids)

      // Assert
      expect(result).toEqual([
        { className: 'A', testMethods: ['a', 'b'] },
        { className: 'B', testMethods: ['a'] },
      ])
    })
  })

  describe('structural return shape (ADR 033)', () => {
    it('Given qualified ids, When toTestItems, Then returns plain structural objects with no org-SDK type involved', () => {
      // Arrange
      const ids = [qualifyTestMethod('FooTest', 'testA')]

      // Act
      const result = toTestItems(ids)

      // Assert
      expect(result).toEqual([{ className: 'FooTest', testMethods: ['testA'] }])
    })
  })
})
