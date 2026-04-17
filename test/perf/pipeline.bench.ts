import { bench, describe } from 'vitest'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import {
  generateApexClass,
  generateCoveredLines,
} from './fixtures/generateFixtures.js'

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const classContent = generateApexClass(size)
  const coveredLines = generateCoveredLines(size)
  const generator = new MutantGenerator()

  describe(`pipeline-${size}`, () => {
    bench(`pipeline-${size}-compute-mutations`, () => {
      generator.compute(classContent, coveredLines)
    })

    bench(`pipeline-${size}-type-discovery`, async () => {
      const discoverer = new TypeDiscoverer()
      await discoverer.analyze(classContent)
    })
  })
}

describe('pipeline-mutation-apply', () => {
  const classContent = generateApexClass('medium')
  const coveredLines = generateCoveredLines('medium')
  const generator = new MutantGenerator()
  const { mutations, tokenStream } = generator.compute(
    classContent,
    coveredLines
  )

  bench('pipeline-apply-all-mutations', () => {
    for (const mutation of mutations) {
      generator.mutate(mutation, tokenStream)
    }
  })
})
