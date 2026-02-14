import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { ArithmeticOperatorDeletionMutator } from '../../../src/mutator/arithmeticOperatorDeletionMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

const createArithmeticExpressionWithTokens = (
  left: string,
  operator: string,
  right: string
) => {
  const operatorNode = new TerminalNode({ text: operator } as Token)
  const leftNode = { text: left }
  const rightNode = { text: right }

  return {
    childCount: 3,
    text: `${left}${operator}${right}`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, left.length + operator.length + right.length),
    children: [leftNode, operatorNode, rightNode],
    getChild: (index: number) => {
      if (index === 0) return leftNode
      if (index === 1) return operatorNode
      return rightNode
    },
  } as unknown as ParserRuleContext
}

describe('ArithmeticOperatorDeletionMutator', () => {
  let sut: ArithmeticOperatorDeletionMutator

  beforeEach(() => {
    sut = new ArithmeticOperatorDeletionMutator()
  })

  describe('Given an addition expression (a + b)', () => {
    describe('When entering the expression', () => {
      it('Then should create 2 mutations: first operand and second operand', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens('a', '+', 'b')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('a')
        expect(sut._mutations[1].replacement).toBe('b')
      })
    })
  })

  describe('Given a subtraction expression (a - b)', () => {
    describe('When entering the expression', () => {
      it('Then should create 2 mutations: first operand and second operand', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens('a', '-', 'b')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('a')
        expect(sut._mutations[1].replacement).toBe('b')
      })
    })
  })

  describe('Given a multiplication expression (a * b)', () => {
    describe('When entering the expression', () => {
      it('Then should create 2 mutations: first operand and second operand', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens('a', '*', 'b')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('a')
        expect(sut._mutations[1].replacement).toBe('b')
      })
    })
  })

  describe('Given a division expression (a / b)', () => {
    describe('When entering the expression', () => {
      it('Then should create 2 mutations: first operand and second operand', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens('a', '/', 'b')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('a')
        expect(sut._mutations[1].replacement).toBe('b')
      })
    })
  })

  describe('Given an expression with insufficient children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = { childCount: 2 } as unknown as ParserRuleContext

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression where operator is not a TerminalNode', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 3,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given an expression with non-arithmetic operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens('a', '==', 'b')

        // Act
        sut.enterArth1Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given string literal operands with + operator', () => {
    describe('When entering the expression', () => {
      it('Then should NOT mutate string concatenation', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens(
          "'hello'",
          '+',
          "'world'"
        )

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given string variable operands with + operator', () => {
    describe('When entering the expression', () => {
      it('Then should NOT mutate when tracked variable is String', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'String',
          'name'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const ctx = createArithmeticExpressionWithTokens('name', '+', 'suffix')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given numeric variable operands with + operator', () => {
    describe('When entering the expression', () => {
      it('Then should create mutations', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDeclA = TestUtil.createLocalVariableDeclaration('Integer', 'a')
        sut.enterLocalVariableDeclaration(varDeclA)

        const varDeclB = TestUtil.createLocalVariableDeclaration('Integer', 'b')
        sut.enterLocalVariableDeclaration(varDeclB)

        const ctx = createArithmeticExpressionWithTokens('a', '+', 'b')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
      })
    })
  })

  describe('Given numeric literals', () => {
    describe('When entering the expression', () => {
      it('Then should create mutations for 1 + 2', () => {
        // Arrange
        const ctx = createArithmeticExpressionWithTokens('1', '+', '2')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('1')
        expect(sut._mutations[1].replacement).toBe('2')
      })
    })
  })

  describe('Given method returning String with + operator', () => {
    describe('When entering the expression', () => {
      it('Then should NOT mutate', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('getName', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const ctx = createArithmeticExpressionWithTokens('getName()', '+', 'x')

        // Act
        sut.enterArth2Expression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given -, *, / operators', () => {
    it('Then should always generate mutations for - regardless of operand types', () => {
      // Arrange
      const ctx = createArithmeticExpressionWithTokens('a', '-', 'b')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })

    it('Then should always generate mutations for * regardless of operand types', () => {
      // Arrange
      const ctx = createArithmeticExpressionWithTokens('a', '*', 'b')

      // Act
      sut.enterArth1Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })

    it('Then should always generate mutations for / regardless of operand types', () => {
      // Arrange
      const ctx = createArithmeticExpressionWithTokens('a', '/', 'b')

      // Act
      sut.enterArth1Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given field tracking', () => {
    it('Then should NOT mutate + when class-level String field is used', () => {
      // Arrange
      const fieldDecl = TestUtil.createFieldDeclaration('String', 'label')
      sut.enterFieldDeclaration(fieldDecl)

      const ctx = createArithmeticExpressionWithTokens('label', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
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

      const ctx = createArithmeticExpressionWithTokens('name', '+', 'other')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })
  })

  describe('Given formal parameter tracking', () => {
    it('Then should NOT mutate + when parameter is String type', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const paramCtx = TestUtil.createFormalParameter('String', 'input')
      sut.enterFormalParameter(paramCtx)

      const ctx = createArithmeticExpressionWithTokens('input', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given enhanced for control tracking', () => {
    it('Then should NOT mutate + when loop variable is String type', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const forCtx = TestUtil.createEnhancedForControl('String', 'item')
      sut.enterEnhancedForControl(forCtx)

      const ctx = createArithmeticExpressionWithTokens('item', '+', 'suffix')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given mutations metadata', () => {
    it('Then mutationName should be ArithmeticOperatorDeletionMutator', () => {
      // Arrange
      const ctx = createArithmeticExpressionWithTokens('a', '+', 'b')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
      sut._mutations.forEach(mutation => {
        expect(mutation.mutationName).toBe('ArithmeticOperatorDeletionMutator')
      })
    })
  })

  describe('Given enterAssignExpression', () => {
    it('Then should not directly create mutations', () => {
      // Arrange
      const ctx = {
        childCount: 3,
        getChild: jest.fn().mockReturnValue({}),
      } as unknown as ParserRuleContext

      // Act
      sut.enterAssignExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
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

      const ctx = createArithmeticExpressionWithTokens('acc.Name', '+', '5')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should mutate + when sObject field is numeric (acc.NumberOfEmployees)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('Account', 'acc')
      sut.enterLocalVariableDeclaration(varDecl)

      mockRepository.isSObject.mockReturnValue(true)
      mockRepository.resolveFieldType.mockReturnValue(ApexType.INTEGER)

      const ctx = createArithmeticExpressionWithTokens(
        'acc.NumberOfEmployees',
        '+',
        '5'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
    })

    it('Then should NOT mutate + when sObject field is unknown (conservative)', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('Account', 'acc')
      sut.enterLocalVariableDeclaration(varDecl)

      mockRepository.isSObject.mockReturnValue(true)
      mockRepository.resolveFieldType.mockReturnValue(undefined)

      const ctx = createArithmeticExpressionWithTokens(
        'acc.UnknownField',
        '+',
        '5'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given field access operands without sObject describe data', () => {
    it('Then should NOT mutate + when root type is non-numeric', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('MyObject', 'obj')
      sut.enterLocalVariableDeclaration(varDecl)

      const ctx = createArithmeticExpressionWithTokens('obj.field', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Then should mutate + when root type is numeric', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const varDecl = TestUtil.createLocalVariableDeclaration(
        'Integer',
        'wrapper'
      )
      sut.enterLocalVariableDeclaration(varDecl)

      const ctx = createArithmeticExpressionWithTokens(
        'wrapper.value',
        '+',
        '1'
      )

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(2)
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

      const ctx = createArithmeticExpressionWithTokens('getName()', '+', 'x')

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given expression without start/stop tokens', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const operatorNode = new TerminalNode({ text: '+' } as Token)
      const ctx = {
        childCount: 3,
        getChild: (index: number) => {
          if (index === 0) return { text: 'a' }
          if (index === 1) return operatorNode
          return { text: 'b' }
        },
        start: null,
        stop: null,
      } as unknown as ParserRuleContext

      // Act
      sut.enterArth2Expression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })
})
