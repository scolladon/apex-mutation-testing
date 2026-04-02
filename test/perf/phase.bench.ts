import { CharStreams, CommonTokenStream } from 'antlr4ts'
import { ApexLexer, ApexParser } from 'apex-parser'
import { bench, describe } from 'vitest'
import { generateApexClass } from './fixtures/generateFixtures.js'

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const classContent = generateApexClass(size)

  describe(`phase-antlr-parse-${size}`, () => {
    bench(`antlr-lex-${size}`, () => {
      const inputStream = CharStreams.fromString(classContent)
      const lexer = new ApexLexer(inputStream)
      const tokenStream = new CommonTokenStream(lexer)
      tokenStream.fill()
    })

    bench(`antlr-parse-${size}`, () => {
      const inputStream = CharStreams.fromString(classContent)
      const lexer = new ApexLexer(inputStream)
      const tokenStream = new CommonTokenStream(lexer)
      const parser = new ApexParser(tokenStream)
      parser.compilationUnit()
    })
  })
}
