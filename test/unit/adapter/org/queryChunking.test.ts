import { chunk } from '../../../../src/adapter/org/queryChunking.js'

// Both readByDeveloperNames and readIdentities rely on chunk([]) yielding
// zero chunks to skip the org round-trip entirely — pinned directly here so
// a change to the loop bound is caught at its source rather than only via a
// downstream consumer's guard.
describe('chunk', () => {
  it('Given an empty array, When chunking, Then it yields no chunks', () => {
    // Act
    const result = chunk([], 200)

    // Assert
    expect(result).toEqual([])
  })

  it('Given a single item, When chunking, Then it yields one chunk holding that item', () => {
    // Act
    const result = chunk(['a'], 200)

    // Assert
    expect(result).toEqual([['a']])
  })

  it('Given a perimeter exactly the chunk size, When chunking, Then it yields exactly one chunk', () => {
    // Arrange
    const items = Array.from({ length: 200 }, (_, i) => `Item${i}`)

    // Act
    const result = chunk(items, 200)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(items)
  })

  it('Given one item more than the chunk size, When chunking, Then it yields two chunks of 200 then 1', () => {
    // Arrange
    const items = Array.from({ length: 201 }, (_, i) => `Item${i}`)

    // Act
    const result = chunk(items, 200)

    // Assert
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(200)
    expect(result[1]).toEqual(['Item200'])
  })
})
