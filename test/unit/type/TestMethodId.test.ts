import {
  qualifyTestMethod,
  testClassOf,
  testMethodOf,
  toTestItems,
} from '../../../src/type/TestMethodId.js'

// 18-character org Ids, pinned equal in width on both namespaced and
// non-namespaced orgs. CLASS_ID_LOCAL and CLASS_ID_FOREIGN differ in more
// than case, so a fixture using both can tell a real id join from a vacuous
// one. TEST_CLASS_ID is a distinct third value, used by tests that don't
// need to distinguish two class ids.
const TEST_CLASS_ID = '01pjV000000EE9cQAG'
const CLASS_ID_LOCAL = '01pjV000000EE9ZQAW'
const CLASS_ID_FOREIGN = '01pjV000000EE9bQAG'

describe('TestMethodId', () => {
  describe('qualifyTestMethod', () => {
    it('Given a class id and a method name, When qualifyTestMethod, Then joins them with a dot', () => {
      // Act
      const result = qualifyTestMethod(TEST_CLASS_ID, 'testRun')

      // Assert
      expect(result).toBe('01pjV000000EE9cQAG.testRun')
    })
  })

  describe('testClassOf / testMethodOf', () => {
    it('Given an id qualified by an 18-character class id, When testClassOf, Then returns the class id', () => {
      // Arrange
      const sut = qualifyTestMethod(TEST_CLASS_ID, 'testRun')

      // Act
      const result = testClassOf(sut)

      // Assert
      expect(result).toBe(TEST_CLASS_ID)
    })

    it('Given an id qualified by an 18-character class id, When testMethodOf, Then returns the method name', () => {
      // Arrange
      const sut = qualifyTestMethod(TEST_CLASS_ID, 'testRun')

      // Act
      const result = testMethodOf(sut)

      // Assert
      expect(result).toBe('testRun')
    })

    it('Given two ids sharing a method name but minted from different class ids, When collected into a Set, Then both survive as distinct entries', () => {
      // Arrange
      const local = qualifyTestMethod(CLASS_ID_LOCAL, 'testFoo')
      const foreign = qualifyTestMethod(CLASS_ID_FOREIGN, 'testFoo')

      // Act
      const result = new Set([local, foreign])

      // Assert
      expect(result.size).toBe(2)
    })
  })

  describe('round-trip property lens', () => {
    it('Given a map of class ids to method sets, When qualified then folded back through toTestItems, Then reproduces the input exactly', () => {
      // Arrange
      const fixture = new Map<string, Set<string>>([
        [CLASS_ID_LOCAL, new Set(['testA', 'testB'])],
        [CLASS_ID_FOREIGN, new Set(['testA'])],
      ])
      const ids = [...fixture].flatMap(([classId, methods]) =>
        [...methods].map(methodName => qualifyTestMethod(classId, methodName))
      )

      // Act
      const result = toTestItems(ids)

      // Assert
      expect(result).toEqual([
        { classId: CLASS_ID_LOCAL, testMethods: ['testA', 'testB'] },
        { classId: CLASS_ID_FOREIGN, testMethods: ['testA'] },
      ])
    })
  })

  describe('toTestItems grouping', () => {
    it('Given interleaved ids across two classes sharing a method name, When toTestItems, Then groups by class id preserving first-seen class and method order', () => {
      // Arrange — CLASS_ID_LOCAL and CLASS_ID_FOREIGN each declare 'a', so a
      // vacuous fixture (using the same string for two classes) could not
      // distinguish a correct id-keyed grouping from a broken one.
      const ids = [
        qualifyTestMethod(CLASS_ID_LOCAL, 'a'),
        qualifyTestMethod(CLASS_ID_FOREIGN, 'a'),
        qualifyTestMethod(CLASS_ID_LOCAL, 'b'),
      ]

      // Act
      const result = toTestItems(ids)

      // Assert
      expect(result).toEqual([
        { classId: CLASS_ID_LOCAL, testMethods: ['a', 'b'] },
        { classId: CLASS_ID_FOREIGN, testMethods: ['a'] },
      ])
    })
  })

  describe('structural return shape (no apex-node types)', () => {
    it('Given qualified ids, When toTestItems, Then returns plain structural objects with no org-SDK type involved', () => {
      // Arrange
      const ids = [qualifyTestMethod(TEST_CLASS_ID, 'testA')]

      // Act
      const result = toTestItems(ids)

      // Assert
      expect(result).toEqual([
        { classId: TEST_CLASS_ID, testMethods: ['testA'] },
      ])
    })
  })
})
