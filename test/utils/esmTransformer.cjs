const { TsJestTransformer } = require('ts-jest')

const IMPORT_META_RE = /import\.meta\.url/g
const IMPORT_META_REPLACEMENT = "('file://' + __filename)"

class EsmSafeTransformer extends TsJestTransformer {
  process(sourceText, sourcePath, transformOptions) {
    const result = super.process(sourceText, sourcePath, transformOptions)
    const code = typeof result === 'string' ? result : result.code
    const replaced = code.replace(IMPORT_META_RE, IMPORT_META_REPLACEMENT)
    if (typeof result === 'string') {
      return replaced
    }
    return { ...result, code: replaced }
  }

  async processAsync(sourceText, sourcePath, transformOptions) {
    const result = await super.processAsync(
      sourceText,
      sourcePath,
      transformOptions
    )
    return {
      ...result,
      code: result.code.replace(IMPORT_META_RE, IMPORT_META_REPLACEMENT),
    }
  }
}

module.exports = {
  createTransformer(config) {
    return new EsmSafeTransformer(config)
  },
}
