import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'
import { SObjectDescribeRepository } from '../../src/adapter/sObjectDescribeRepository.js'
import { MutationListener } from '../../src/mutator/mutationListener.js'
import { NonVoidMethodCallMutator } from '../../src/mutator/nonVoidMethodCallMutator.js'
import { MutantGenerator } from '../../src/service/mutantGenerator.js'
import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../src/service/typeMatcher.js'
import { ApexType } from '../../src/type/ApexMethod.js'

describe('NonVoidMethodCallMutator Integration', () => {
  const parseAndMutate = async (
    code: string,
    coveredLines: Set<number>,
    sObjectDescribeRepository?: SObjectDescribeRepository
  ) => {
    const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new ApexParser(tokenStream)
    const tree = parser.compilationUnit()

    const sObjectTypes = sObjectDescribeRepository
      ? new Set(['Account'])
      : new Set<string>()
    const typeDiscoverer = new TypeDiscoverer()
      .withMatcher(new ApexClassTypeMatcher(new Set()))
      .withMatcher(
        new SObjectTypeMatcher(sObjectTypes, sObjectDescribeRepository)
      )
    const typeRegistry = await typeDiscoverer.analyze(code)

    const nonVoidMethodCallMutator = new NonVoidMethodCallMutator(typeRegistry)
    const listener = new MutationListener(
      [nonVoidMethodCallMutator],
      coveredLines
    )

    ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
    return listener.getMutations()
  }

  describe('variable declarations with method calls', () => {
    it('should mutate Integer variable declaration with method call', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer x = getValue();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('0')
      expect(mutations[0].mutationName).toBe('NonVoidMethodCallMutator')
    })

    it('should mutate String variable declaration with method call', async () => {
      const code = `
        public class TestClass {
          public void test() {
            String s = getName();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe("''")
    })

    it('should mutate Boolean variable declaration with method call', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Boolean b = isValid();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('false')
    })

    it('should mutate List variable declaration with method call', async () => {
      const code = `
        public class TestClass {
          public void test() {
            List<String> items = getItems();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('new List<String>()')
    })

    it('should mutate custom class variable declaration with method call', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Account acc = getAccount();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('null')
    })

    it('should handle dot expression method calls', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer count = helper.getCount();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe('0')
    })

    it('should handle chained method calls', async () => {
      const code = `
        public class TestClass {
          public void test() {
            String name = obj.getInner().getName();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe("''")
    })
  })

  describe('assignment expressions with method calls', () => {
    it('should mutate assignment to local variable', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer x;
            x = getValue();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4, 5]))

      const assignMutations = mutations.filter(
        m => m.mutationName === 'NonVoidMethodCallMutator'
      )
      expect(assignMutations.length).toBe(1)
      expect(assignMutations[0].replacement).toBe('0')
    })

    it('should mutate assignment to class field', async () => {
      const code = `
        public class TestClass {
          private String myField;

          public void test() {
            myField = getName();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([6]))

      expect(mutations.length).toBe(1)
      expect(mutations[0].replacement).toBe("''")
    })
  })

  describe('SObject field assignments', () => {
    it('should mutate SObject String field assignment', async () => {
      const mockSObjectRepo = {
        isSObject: (type: string) => type.toLowerCase() === 'account',
        resolveFieldType: (type: string, field: string) => {
          if (
            type.toLowerCase() === 'account' &&
            field.toLowerCase() === 'name'
          )
            return ApexType.STRING
          return undefined
        },
        describe: jest.fn(),
      } as unknown as SObjectDescribeRepository

      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
            acc.Name = getName();
          }
        }
      `

      const mutations = await parseAndMutate(
        code,
        new Set([4, 5]),
        mockSObjectRepo
      )

      const fieldMutations = mutations.filter(
        m =>
          m.mutationName === 'NonVoidMethodCallMutator' &&
          m.replacement === "''"
      )
      expect(fieldMutations.length).toBe(1)
    })

    it('should mutate SObject Integer field assignment', async () => {
      const mockSObjectRepo = {
        isSObject: (type: string) => type.toLowerCase() === 'account',
        resolveFieldType: (type: string, field: string) => {
          if (
            type.toLowerCase() === 'account' &&
            field.toLowerCase() === 'numberofemployees'
          )
            return ApexType.INTEGER
          return undefined
        },
        describe: jest.fn(),
      } as unknown as SObjectDescribeRepository

      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
            acc.NumberOfEmployees = getCount();
          }
        }
      `

      const mutations = await parseAndMutate(
        code,
        new Set([4, 5]),
        mockSObjectRepo
      )

      const fieldMutations = mutations.filter(
        m =>
          m.mutationName === 'NonVoidMethodCallMutator' && m.replacement === '0'
      )
      expect(fieldMutations.length).toBe(1)
    })
  })

  describe('should NOT mutate', () => {
    it('should NOT mutate constructor calls', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(0)
    })

    it('should NOT mutate literal assignments', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer x = 42;
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      expect(mutations.length).toBe(0)
    })

    it('should NOT mutate void method calls', async () => {
      const code = `
        public class TestClass {
          public void test() {
            doSomething();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4]))

      // NonVoidMethodCallMutator should not create mutations for void calls
      const nonVoidMutations = mutations.filter(
        m => m.mutationName === 'NonVoidMethodCallMutator'
      )
      expect(nonVoidMutations.length).toBe(0)
    })

    it('should NOT mutate lines not covered', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer x = getValue();
          }
        }
      `

      // Line 4 is not in covered lines
      const mutations = await parseAndMutate(code, new Set([5]))

      expect(mutations.length).toBe(0)
    })
  })

  describe('multiple method calls', () => {
    it('should mutate multiple declarations', async () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer x = getValue();
            String s = getName();
            Boolean b = isValid();
          }
        }
      `

      const mutations = await parseAndMutate(code, new Set([4, 5, 6]))

      expect(mutations.length).toBe(3)
      expect(mutations.map(m => m.replacement).sort()).toEqual(
        ['0', "''", 'false'].sort()
      )
    })
  })

  describe('mutation application', () => {
    it('should produce valid mutated code', async () => {
      const code = `public class TestClass {
  public void test() {
    Integer x = getValue();
  }
}`

      const lexer = new ApexLexer(new CaseInsensitiveInputStream('test', code))
      const tokenStream = new CommonTokenStream(lexer)
      const mutantGenerator = new MutantGenerator()
      mutantGenerator['tokenStream'] = tokenStream

      const parser = new ApexParser(tokenStream)
      const tree = parser.compilationUnit()

      const typeDiscoverer = new TypeDiscoverer()
        .withMatcher(new ApexClassTypeMatcher(new Set()))
        .withMatcher(new SObjectTypeMatcher(new Set()))
      const typeRegistry = await typeDiscoverer.analyze(code)

      const nonVoidMethodCallMutator = new NonVoidMethodCallMutator(
        typeRegistry
      )
      const listener = new MutationListener(
        [nonVoidMethodCallMutator],
        new Set([3])
      )

      ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)
      const mutations = listener.getMutations()

      expect(mutations.length).toBe(1)

      const mutatedCode = mutantGenerator.mutate(mutations[0])
      expect(mutatedCode).toContain('Integer x = 0')
      expect(mutatedCode).not.toContain('getValue()')
    })
  })
})
