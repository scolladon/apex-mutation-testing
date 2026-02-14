import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ArithmeticOperatorMutator } from '../../../src/mutator/arithmeticOperatorMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('ArithmeticOperatorMutator', () => {
  let sut: ArithmeticOperatorMutator
  let mockCtx: ParserRuleContext
  let mockTerminalNode: TerminalNode

  beforeEach(() => {
    // Arrange
    sut = new ArithmeticOperatorMutator()
    mockCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        if (index === 0) return { text: 'a' }
        if (index === 1) return mockTerminalNode
        return { text: 'b' }
      }),
    } as unknown as ParserRuleContext
    mockTerminalNode = {
      text: '+',
    } as unknown as TerminalNode
  })

  it('should mutate addition operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '+' } as Token)

    // Act
    sut.enterArth2Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('-')
    expect(sut['_mutations'][1].replacement).toBe('*')
    expect(sut['_mutations'][2].replacement).toBe('/')
  })

  it('should mutate subtraction operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '-' } as Token)

    // Act
    sut.enterArth2Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('+')
    expect(sut['_mutations'][1].replacement).toBe('*')
    expect(sut['_mutations'][2].replacement).toBe('/')
  })

  it('should mutate multiplication operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '*' } as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('+')
    expect(sut['_mutations'][1].replacement).toBe('-')
    expect(sut['_mutations'][2].replacement).toBe('/')
  })

  it('should mutate division operator', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '/' } as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('+')
    expect(sut['_mutations'][1].replacement).toBe('-')
    expect(sut['_mutations'][2].replacement).toBe('*')
  })

  it('should not mutate when child count is not 3', () => {
    // Arrange
    mockCtx = { childCount: 2 } as unknown as ParserRuleContext

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not mutate when terminal node is not found', () => {
    // Arrange
    mockCtx.getChild = jest.fn().mockReturnValue({})

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should not mutate when operator is not in replacement map', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '==' } as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should have an enterAssignExpression method', () => {
    // Assert
    expect(typeof sut.enterAssignExpression).toBe('function')
  })

  it('enterAssignExpression should not directly create mutations', () => {
    // Arrange
    const assignCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        // Right side is an arithmetic expression
        if (index === 2) {
          return {
            // Arth2Expression in the actual parse tree
          }
        }
        return {}
      }),
    } as unknown as ParserRuleContext

    // Act
    sut.enterAssignExpression(assignCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0) // No mutations directly from enterAssignExpression
  })

  it('should process arithmetic operations in assignment expressions via traversal', () => {
    // Arrange
    const assignCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        return index === 2
          ? {
              //visited separately by the parser
            }
          : {}
      }),
    } as unknown as ParserRuleContext

    mockTerminalNode = new TerminalNode({ text: '+' } as Token)

    const arithmeticCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        if (index === 0) return { text: 'a' }
        if (index === 1) return mockTerminalNode
        return { text: 'b' }
      }),
    } as unknown as ParserRuleContext

    // Act
    sut.enterAssignExpression(assignCtx)
    sut.enterArth2Expression(arithmeticCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    expect(sut['_mutations'][0].replacement).toBe('-')
  })

  it('should handle multiple operators in sequence', () => {
    // Arrange
    const firstArithmeticCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        if (index === 0) return { text: 'a' }
        if (index === 1) return new TerminalNode({ text: '+' } as Token)
        return { text: 'b' }
      }),
    } as unknown as ParserRuleContext

    const secondArithmeticCtx = {
      childCount: 3,
      getChild: jest.fn().mockImplementation(index => {
        if (index === 0) return { text: 'a' }
        if (index === 1) return new TerminalNode({ text: '*' } as Token)
        return { text: 'b' }
      }),
    } as unknown as ParserRuleContext

    // Act
    sut.enterArth2Expression(firstArithmeticCtx)
    sut.enterArth1Expression(secondArithmeticCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(6)

    // for +
    expect(sut['_mutations'][0].replacement).toBe('-')
    expect(sut['_mutations'][1].replacement).toBe('*')
    expect(sut['_mutations'][2].replacement).toBe('/')

    // for *
    expect(sut['_mutations'][3].replacement).toBe('+')
    expect(sut['_mutations'][4].replacement).toBe('-')
    expect(sut['_mutations'][5].replacement).toBe('/')
  })

  it('should create mutations with correct mutator name', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: '+' } as Token)

    // Act
    sut.enterArth2Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(3)
    sut['_mutations'].forEach(mutation => {
      expect(mutation.mutationName).toBe('ArithmeticOperatorMutator')
    })
  })

  it('should not mutate non-arithmetic operators', () => {
    // Arrange
    const nonArithmeticOperators = [
      '==',
      '!=',
      '&&',
      '||',
      '>',
      '<',
      '>=',
      '<=',
    ]

    nonArithmeticOperators.forEach(operator => {
      sut = new ArithmeticOperatorMutator()
      mockTerminalNode = new TerminalNode({ text: operator } as Token)

      // Act
      sut.enterArth1Expression(mockCtx)
      sut.enterArth2Expression(mockCtx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  it('should handle edge case with null terminal node text', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: null } as unknown as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  it('should handle edge case with undefined terminal node text', () => {
    // Arrange
    mockTerminalNode = new TerminalNode({ text: undefined } as unknown as Token)

    // Act
    sut.enterArth1Expression(mockCtx)

    // Assert
    expect(sut['_mutations']).toHaveLength(0)
  })

  describe('Given string literal operands', () => {
    it("Then should NOT mutate + when left operand is a string literal ('hello' + 'world')", () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression("'hello'", '+', "'world'")

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it("Then should NOT mutate + when right operand is a string literal (count + 'items')", () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression('count', '+', "'items'")

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given string variable operands', () => {
    it('Then should NOT mutate + when operand is a tracked String variable', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('String', 'name')
      sut.enterLocalVariableDeclaration(varDecl)

      const ctx = TestUtil.createArithmeticExpression('name', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given numeric operands', () => {
    it('Then should mutate + when operands are tracked Integer variables', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDeclA = TestUtil.createLocalVariableDeclaration('Integer', 'a')
      sut.enterLocalVariableDeclaration(varDeclA)

      const varDeclB = TestUtil.createLocalVariableDeclaration('Integer', 'b')
      sut.enterLocalVariableDeclaration(varDeclB)

      const ctx = TestUtil.createArithmeticExpression('a', '+', 'b')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })

    it('Then should mutate + for numeric literals (1 + 2)', () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression('1', '+', '2')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })
  })

  describe('Given method return type detection', () => {
    it('Then should NOT mutate + when method call returns String', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('getName', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)

      const ctx = TestUtil.createArithmeticExpression('getName()', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Then should mutate + when method call returns Integer', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('getCount', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const ctx = TestUtil.createArithmeticExpression('getCount()', '+', '1')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })
  })

  describe('Given no type information available', () => {
    it('Then should default to generating mutations for +', () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression('a', '+', 'b')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })
  })

  describe('Given -, *, / operators', () => {
    it('Then should always generate mutations for - regardless of operand types', () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression('a', '-', 'b')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })

    it('Then should always generate mutations for * regardless of operand types', () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression('a', '*', 'b')

      // Act
      sut.enterArth1Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })

    it('Then should always generate mutations for / regardless of operand types', () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression('a', '/', 'b')

      // Act
      sut.enterArth1Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })
  })

  describe('Given field tracking', () => {
    it('Then should NOT mutate + when class-level String field is used', () => {
      // Arrange
      const fieldDecl = TestUtil.createFieldDeclaration('String', 'label')
      sut.enterFieldDeclaration(fieldDecl)

      const ctx = TestUtil.createArithmeticExpression('label', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given scope isolation', () => {
    it('Then String variable in method A should not affect method B', () => {
      // Arrange
      const methodACtx = TestUtil.createMethodDeclaration('void', 'methodA')
      sut.enterMethodDeclaration(methodACtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('String', 'name')
      sut.enterLocalVariableDeclaration(varDecl)

      sut.exitMethodDeclaration()

      const methodBCtx = TestUtil.createMethodDeclaration('void', 'methodB')
      sut.enterMethodDeclaration(methodBCtx)

      const ctx = TestUtil.createArithmeticExpression('name', '+', 'other')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })
  })

  describe('Given formal parameter tracking', () => {
    it('Then should NOT mutate + when parameter is String type', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const paramCtx = TestUtil.createFormalParameter('String', 'input')
      sut.enterFormalParameter(paramCtx)

      const ctx = TestUtil.createArithmeticExpression('input', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given enhanced for control tracking', () => {
    it('Then should NOT mutate + when loop variable is String type', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const forCtx = TestUtil.createEnhancedForControl('String', 'item')
      sut.enterEnhancedForControl(forCtx)

      const ctx = TestUtil.createArithmeticExpression('item', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given field access operands with sObject describe data', () => {
    let mockRepository: {
      isSObject: jest.Mock
      resolveFieldType: jest.Mock
      describe: jest.Mock
    }

    beforeEach(() => {
      mockRepository = {
        isSObject: jest.fn(),
        resolveFieldType: jest.fn(),
        describe: jest.fn(),
      }
      sut.setSObjectDescribeRepository(
        mockRepository as unknown as import('../../../src/adapter/sObjectDescribeRepository.js').SObjectDescribeRepository
      )
    })

    it('Then should NOT mutate + when sObject field is non-numeric (acc.Name)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('Account', 'acc')
      sut.enterLocalVariableDeclaration(varDecl)

      mockRepository.isSObject.mockReturnValue(true)
      mockRepository.resolveFieldType.mockReturnValue(ApexType.STRING)

      const ctx = TestUtil.createArithmeticExpression('acc.Name', '+', '5')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Then should mutate + when sObject field is numeric (acc.NumberOfEmployees)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('Account', 'acc')
      sut.enterLocalVariableDeclaration(varDecl)

      mockRepository.isSObject.mockReturnValue(true)
      mockRepository.resolveFieldType.mockReturnValue(ApexType.INTEGER)

      const ctx = TestUtil.createArithmeticExpression(
        'acc.NumberOfEmployees',
        '+',
        '5'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })

    it('Then should NOT mutate + when sObject field is unknown (conservative)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('Account', 'acc')
      sut.enterLocalVariableDeclaration(varDecl)

      mockRepository.isSObject.mockReturnValue(true)
      mockRepository.resolveFieldType.mockReturnValue(undefined)

      const ctx = TestUtil.createArithmeticExpression(
        'acc.UnknownField',
        '+',
        '5'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given field access operands without sObject describe data', () => {
    it('Then should NOT mutate + when root type is non-numeric (obj.field, fallback)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('MyObject', 'obj')
      sut.enterLocalVariableDeclaration(varDecl)

      const ctx = TestUtil.createArithmeticExpression('obj.field', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Then should mutate + when root type is numeric (wrapper.value, fallback)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration(
        'Integer',
        'wrapper'
      )
      sut.enterLocalVariableDeclaration(varDecl)

      const ctx = TestUtil.createArithmeticExpression('wrapper.value', '+', '1')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })
  })

  describe('Given compound sub-expression operands', () => {
    it("Then should NOT mutate + when left operand is a compound expression containing a string literal (acc.Name+' has ')", () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression(
        "acc.Name+' has '",
        '+',
        'count'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it("Then should NOT mutate + when right operand is a compound expression containing a string literal (count+' items')", () => {
      // Arrange
      const ctx = TestUtil.createArithmeticExpression(
        'total',
        '+',
        "count+' items'"
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })

  describe('Given edge cases for type tracking', () => {
    it('Then should handle enterFormalParameter with no children gracefully', () => {
      // Arrange
      const paramCtx = { children: null } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => sut.enterFormalParameter(paramCtx)).not.toThrow()
    })

    it('Then should handle enterEnhancedForControl with no children gracefully', () => {
      // Arrange
      const forCtx = { children: null } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => sut.enterEnhancedForControl(forCtx)).not.toThrow()
    })

    it('Then should handle enterLocalVariableDeclaration with no children gracefully', () => {
      // Arrange
      const varCtx = { children: null } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => sut.enterLocalVariableDeclaration(varCtx)).not.toThrow()
    })

    it('Then should handle enterFieldDeclaration with no children gracefully', () => {
      // Arrange
      const fieldCtx = { children: null } as unknown as ParserRuleContext

      // Act & Assert
      expect(() => sut.enterFieldDeclaration(fieldCtx)).not.toThrow()
    })

    it('Then should mutate + when method call is not in type table', () => {
      // Arrange
      sut.setTypeTable(new Map())
      const ctx = TestUtil.createArithmeticExpression(
        'unknownMethod()',
        '+',
        'x'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(3)
    })

    it('Then should handle variable declarations with comma separators', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varCtx = {
        children: [
          { text: 'String' },
          { text: 'a' },
          { text: ',' },
          { text: 'b' },
        ],
        childCount: 4,
        start: TestUtil.createToken(1, 0),
      } as unknown as ParserRuleContext
      sut.enterLocalVariableDeclaration(varCtx)

      const ctx = TestUtil.createArithmeticExpression('b', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Then should handle variable declarations with initializer (=)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varCtx = {
        children: [{ text: 'String' }, { text: "name='test'" }],
        childCount: 2,
        start: TestUtil.createToken(1, 0),
      } as unknown as ParserRuleContext
      sut.enterLocalVariableDeclaration(varCtx)

      const ctx = TestUtil.createArithmeticExpression('name', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })

    it('Then should resolve unknown type as OBJECT (non-numeric)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varCtx = TestUtil.createLocalVariableDeclaration('Account', 'acc')
      sut.enterLocalVariableDeclaration(varCtx)

      const ctx = TestUtil.createArithmeticExpression('acc', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut['_mutations']).toHaveLength(0)
    })
  })
})
