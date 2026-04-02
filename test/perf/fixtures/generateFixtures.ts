type FixtureSize = 'small' | 'medium' | 'large'

interface SizeConfig {
  readonly methods: number
  readonly linesPerMethod: number
}

const SIZE_CONFIGS: Record<FixtureSize, SizeConfig> = {
  small: { methods: 3, linesPerMethod: 10 },
  medium: { methods: 10, linesPerMethod: 15 },
  large: { methods: 25, linesPerMethod: 20 },
}

const generateMethod = (index: number, lineCount: number): string => {
  const lines: string[] = []
  const isVoid = index % 3 === 0
  const returnType = isVoid ? 'void' : index % 3 === 1 ? 'String' : 'Integer'

  lines.push(`    public ${returnType} method${index}(Integer param${index}) {`)

  for (let i = 0; i < lineCount; i++) {
    const mod = i % 8
    switch (mod) {
      case 0:
        lines.push(`        Integer local${i} = param${index} + ${i};`)
        break
      case 1:
        lines.push(
          `        if (local${i - 1} > ${i * 10}) { local${i - 1} = local${i - 1} - 1; }`
        )
        break
      case 2:
        lines.push(`        Boolean flag${i} = local${i - 2} >= 0 && true;`)
        break
      case 3:
        lines.push(
          `        String text${i} = 'value' + String.valueOf(local${i - 3});`
        )
        break
      case 4:
        lines.push(
          `        local${i - 4} = local${i - 4} * 2 + (flag${i - 2} ? 1 : 0);`
        )
        break
      case 5:
        lines.push(`        Integer counter${i} = 0;`)
        lines.push(
          `        while (counter${i} < local${i - 5}) { counter${i}++; }`
        )
        break
      case 6:
        lines.push(`        List<String> items${i} = new List<String>();`)
        lines.push(`        items${i}.add(text${i - 3});`)
        break
      case 7:
        lines.push(`        if (flag${i - 5} == false || local${i - 7} <= 0) {`)
        lines.push(`            local${i - 7} = -local${i - 7};`)
        lines.push('        }')
        break
    }
  }

  if (isVoid) {
    lines.push(`        System.debug('method${index} done: ' + param${index});`)
  } else if (returnType === 'String') {
    lines.push(`        return 'result_' + String.valueOf(param${index});`)
  } else {
    lines.push(`        return param${index} + ${lineCount};`)
  }

  lines.push('    }')
  return lines.join('\n')
}

export const generateApexClass = (size: FixtureSize): string => {
  const config = SIZE_CONFIGS[size]
  const methods = Array.from({ length: config.methods }, (_, i) =>
    generateMethod(i, config.linesPerMethod)
  )
  return `public class BenchmarkClass {
    String label = '';
    Integer counter = 0;
    Boolean active = true;

${methods.join('\n\n')}
}`
}

export const generateCoveredLines = (size: FixtureSize): Set<number> => {
  const config = SIZE_CONFIGS[size]
  const totalLines = 4 + config.methods * (config.linesPerMethod + 5)
  const covered = new Set<number>()
  for (let i = 5; i <= totalLines; i++) {
    if (i % 4 !== 0) {
      covered.add(i)
    }
  }
  return covered
}
