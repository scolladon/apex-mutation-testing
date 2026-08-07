import {
  attachSuiteProvenance,
  reducePerimeter,
  SkippedTestClass,
} from '../../../src/type/SkippedTestClass.js'
import { TestClassOrigins } from '../../../src/type/TestClassOrigin.js'

describe('attachSuiteProvenance', () => {
  it('Given verdicts and undefined origins, When attached, Then every entry is returned unchanged', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'no-coverage' },
    ]

    // Act
    const sut = attachSuiteProvenance(skipped, undefined)

    // Assert
    expect(sut).toEqual(skipped)
  })

  it('Given origins keyed lower-case and a verdict class differing only in case, When attached, Then the suite names are attached', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'no-coverage' },
    ]
    const origins: TestClassOrigins = new Map([['badtest', ['SmokeSuite']]])

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut[0]?.suiteNames).toEqual(['SmokeSuite'])
  })

  it('Given origins with no entry for the verdict class, When attached, Then that entry has no suiteNames property', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'no-coverage' },
    ]
    const origins: TestClassOrigins = new Map([['othertest', ['SmokeSuite']]])

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut[0]).not.toHaveProperty('suiteNames')
  })

  it('Given an input array of verdicts, When attached, Then neither the array nor its entries are mutated', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'BadTest', reason: 'no-coverage' },
    ]
    const origins: TestClassOrigins = new Map([['badtest', ['SmokeSuite']]])
    const originalEntry = skipped[0]

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut).not.toBe(skipped)
    expect(skipped[0]).toBe(originalEntry)
    expect(skipped[0]).not.toHaveProperty('suiteNames')
  })

  it('Given a verdict for a class named Constructor and an empty origins map, When attached, Then the entry is returned unchanged and no prototype method is picked up', () => {
    // Arrange
    const skipped: SkippedTestClass[] = [
      { className: 'Constructor', reason: 'no-coverage' },
    ]
    const origins: TestClassOrigins = new Map()

    // Act
    const sut = attachSuiteProvenance(skipped, origins)

    // Assert
    expect(sut).toEqual(skipped)
  })
})

describe('reducePerimeter', () => {
  it('Given a middle perimeter entry is skipped, When reduced, Then the remaining order is preserved', () => {
    // Arrange
    const perimeter = ['FooTest', 'BarTest', 'BazTest']
    const skipped: SkippedTestClass[] = [
      { className: 'BarTest', reason: 'no-coverage' },
    ]

    // Act
    const sut = reducePerimeter(perimeter, skipped)

    // Assert
    expect(sut).toEqual(['FooTest', 'BazTest'])
  })

  it('Given a skip whose className differs only by case, When reduced, Then the perimeter entry is not dropped', () => {
    // Arrange
    const perimeter = ['BarTest']
    const skipped: SkippedTestClass[] = [
      { className: 'bartest', reason: 'no-coverage' },
    ]

    // Act
    const sut = reducePerimeter(perimeter, skipped)

    // Assert
    expect(sut).toEqual(['BarTest'])
  })

  it('Given an empty skip list, When reduced, Then the perimeter is returned unchanged', () => {
    // Arrange
    const perimeter = ['FooTest', 'BarTest']

    // Act
    const sut = reducePerimeter(perimeter, [])

    // Assert
    expect(sut).toEqual(['FooTest', 'BarTest'])
  })

  it('Given every perimeter entry is skipped, When reduced, Then the result is empty', () => {
    // Arrange
    const perimeter = ['FooTest', 'BarTest']
    const skipped: SkippedTestClass[] = [
      { className: 'FooTest', reason: 'no-coverage' },
      { className: 'BarTest', reason: 'no-coverage' },
    ]

    // Act
    const sut = reducePerimeter(perimeter, skipped)

    // Assert
    expect(sut).toEqual([])
  })
})
