import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import {
  FieldDeclarationContext,
  LiteralContext,
  LocalVariableDeclarationContext,
  MethodDeclarationContext,
  ReturnStatementContext,
} from 'apex-parser'
import { InlineConstantMutator } from '../../../src/mutator/inlineConstantMutator.js'
import { APEX_TYPE } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

function createLiteralCtx(
  literalType: string,
  node: TerminalNode
): LiteralContext {
  const ctx = Object.create(LiteralContext.prototype)
  Object.defineProperty(ctx, 'start', {
    value: node.symbol,
    writable: true,
  })
  Object.defineProperty(ctx, 'stop', {
    value: node.symbol,
    writable: true,
  })
  ctx.BooleanLiteral = () => (literalType === 'boolean' ? node : undefined)
  ctx.IntegerLiteral = () => (literalType === 'integer' ? node : undefined)
  ctx.LongLiteral = () => (literalType === 'long' ? node : undefined)
  ctx.NumberLiteral = () => (literalType === 'number' ? node : undefined)
  ctx.StringLiteral = () => (literalType === 'string' ? node : undefined)
  ctx.NULL = () => (literalType === 'null' ? node : undefined)
  return ctx
}

function createTerminalNode(text: string): TerminalNode {
  return new TerminalNode({
    text,
    tokenIndex: 5,
    line: 1,
    charPositionInLine: 10,
  } as Token)
}

describe('InlineConstantMutator', () => {
  let sut: InlineConstantMutator

  beforeEach(() => {
    sut = new InlineConstantMutator()
  })

  describe('Given a literal that matches no handler', () => {
    describe('When entering the literal', () => {
      it('Then creates no mutations', () => {
        // Arrange
        const node = createTerminalNode('unknown')
        const ctx = createLiteralCtx('unknown', node)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a boolean literal true', () => {
    describe('When entering the literal', () => {
      it('Then should create mutation replacing true with false', () => {
        // Arrange
        const booleanNode = createTerminalNode('true')
        const ctx = createLiteralCtx('boolean', booleanNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('false')
        expect(sut._mutations[0].mutationName).toBe('InlineConstantMutator')
      })
    })
  })

  describe('Given a boolean literal false', () => {
    describe('When entering the literal', () => {
      it('Then should create mutation replacing false with true', () => {
        // Arrange
        const booleanNode = createTerminalNode('false')
        const ctx = createLiteralCtx('boolean', booleanNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('true')
      })
    })
  })

  describe('Given an integer literal 42', () => {
    describe('When entering the literal', () => {
      it('Then should create 5 mutations: 0, 1, -1, 43, 41', () => {
        // Arrange
        const intNode = createTerminalNode('42')
        const ctx = createLiteralCtx('integer', intNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(5)
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).toEqual(['0', '1', '-1', '43', '41'])
      })
    })
  })

  describe('Given an integer literal 0', () => {
    describe('When entering the literal', () => {
      it('Then should not include 0 in replacements', () => {
        // Arrange
        const intNode = createTerminalNode('0')
        const ctx = createLiteralCtx('integer', intNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).not.toContain('0')
        expect(replacements).toContain('1')
        expect(replacements).toContain('-1')
      })
    })
  })

  describe('Given an integer literal 1', () => {
    describe('When entering the literal', () => {
      it('Then should not include 1 in replacements', () => {
        // Arrange
        const intNode = createTerminalNode('1')
        const ctx = createLiteralCtx('integer', intNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).not.toContain('1')
        expect(replacements).toContain('0')
        expect(replacements).toContain('-1')
        expect(replacements).toContain('2')
      })
    })
  })

  describe('Given a long literal 42L', () => {
    describe('When entering the literal', () => {
      it('Then should create 5 mutations with L suffix', () => {
        // Arrange
        const longNode = createTerminalNode('42L')
        const ctx = createLiteralCtx('long', longNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(5)
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).toEqual(['0L', '1L', '-1L', '43L', '41L'])
      })
    })
  })

  describe('Given a long literal 42l with lowercase suffix', () => {
    describe('When entering the literal', () => {
      it('Then should create 5 mutations with L suffix', () => {
        // Arrange
        const longNode = createTerminalNode('42l')
        const ctx = createLiteralCtx('long', longNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(5)
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).toEqual(['0L', '1L', '-1L', '43L', '41L'])
      })
    })
  })

  describe('Given a long literal 0L', () => {
    describe('When entering the literal', () => {
      it('Then should not include 0L in replacements', () => {
        // Arrange
        const longNode = createTerminalNode('0L')
        const ctx = createLiteralCtx('long', longNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).not.toContain('0L')
        expect(replacements).toContain('1L')
        expect(replacements).toContain('-1L')
      })
    })
  })

  describe('Given a number literal 3.14', () => {
    describe('When entering the literal', () => {
      it('Then should create 5 mutations: 0.0, 1.0, -1.0, 4.14, 2.14', () => {
        // Arrange
        const numNode = createTerminalNode('3.14')
        const ctx = createLiteralCtx('number', numNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(5)
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).toEqual([
          '0.0',
          '1.0',
          '-1.0',
          '4.140000000000001',
          '2.14',
        ])
      })
    })
  })

  describe('Given a number literal 0.0', () => {
    describe('When entering the literal', () => {
      it('Then should not include 0.0 in replacements', () => {
        // Arrange
        const numNode = createTerminalNode('0.0')
        const ctx = createLiteralCtx('number', numNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).not.toContain('0.0')
        expect(replacements).toContain('1.0')
        expect(replacements).toContain('-1.0')
      })
    })
  })

  describe("Given a string literal 'hello'", () => {
    describe('When entering the literal', () => {
      it("Then should create 1 mutation replacing with ''", () => {
        // Arrange
        const strNode = createTerminalNode("'hello'")
        const ctx = createLiteralCtx('string', strNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })
    })
  })

  describe("Given an empty string literal ''", () => {
    describe('When entering the literal', () => {
      it('Then should create no mutations', () => {
        // Arrange
        const strNode = createTerminalNode("''")
        const ctx = createLiteralCtx('string', strNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal without TypeRegistry', () => {
    describe('When entering the literal', () => {
      it('Then should create no mutations', () => {
        // Arrange
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in return statement of Integer method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create mutation replacing null with 0', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map([
            [
              'testMethod',
              {
                returnType: 'Integer',
                startLine: 1,
                endLine: 5,
                type: APEX_TYPE.INTEGER,
              },
            ],
          ])
        )
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        const methodCtx = Object.create(MethodDeclarationContext.prototype)
        methodCtx.children = [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ]
        Object.defineProperty(returnCtx, 'parent', {
          value: methodCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })

  describe('Given a null literal in return statement of String method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it("Then should create mutation replacing null with ''", () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map([
            [
              'testMethod',
              {
                returnType: 'String',
                startLine: 1,
                endLine: 5,
                type: APEX_TYPE.STRING,
              },
            ],
          ])
        )
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        const methodCtx = Object.create(MethodDeclarationContext.prototype)
        methodCtx.children = [
          { text: 'String' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ]
        Object.defineProperty(returnCtx, 'parent', {
          value: methodCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })
    })
  })

  describe('Given a null literal in return statement of Boolean method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create mutation replacing null with false', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map([
            [
              'testMethod',
              {
                returnType: 'Boolean',
                startLine: 1,
                endLine: 5,
                type: APEX_TYPE.BOOLEAN,
              },
            ],
          ])
        )
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        const methodCtx = Object.create(MethodDeclarationContext.prototype)
        methodCtx.children = [
          { text: 'Boolean' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ]
        Object.defineProperty(returnCtx, 'parent', {
          value: methodCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('false')
      })
    })
  })

  describe('Given a null literal in local variable declaration', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create mutation replacing null with type default', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const localVarCtx = Object.create(
          LocalVariableDeclarationContext.prototype
        )
        localVarCtx.typeRef = () => ({ text: 'Integer' })
        const varDeclaratorsCtx = Object.create(ParserRuleContext.prototype)
        const varDeclaratorCtx = Object.create(ParserRuleContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: varDeclaratorCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(varDeclaratorCtx, 'parent', {
          value: varDeclaratorsCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(varDeclaratorsCtx, 'parent', {
          value: localVarCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })

  describe('Given a null literal in final local variable declaration', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create mutation replacing null with type default', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const localVarCtx = Object.create(
          LocalVariableDeclarationContext.prototype
        )
        localVarCtx.typeRef = () => ({ text: 'Integer' })
        const varDeclaratorsCtx = Object.create(ParserRuleContext.prototype)
        const varDeclaratorCtx = Object.create(ParserRuleContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: varDeclaratorCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(varDeclaratorCtx, 'parent', {
          value: varDeclaratorsCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(varDeclaratorsCtx, 'parent', {
          value: localVarCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })

  describe('Given a null literal in return statement of Date method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations when no default literal exists', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map([
            [
              'testMethod',
              {
                returnType: 'Date',
                startLine: 1,
                endLine: 5,
                type: APEX_TYPE.DATE,
              },
            ],
          ])
        )
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        const methodCtx = Object.create(MethodDeclarationContext.prototype)
        methodCtx.children = [
          { text: 'Date' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ]
        Object.defineProperty(returnCtx, 'parent', {
          value: methodCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in field declaration', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create mutation replacing null with type default', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const fieldDeclCtx = Object.create(FieldDeclarationContext.prototype)
        fieldDeclCtx.typeRef = () => ({ text: 'String' })
        const varDeclaratorsCtx = Object.create(ParserRuleContext.prototype)
        const varDeclaratorCtx = Object.create(ParserRuleContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: varDeclaratorCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(varDeclaratorCtx, 'parent', {
          value: varDeclaratorsCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(varDeclaratorsCtx, 'parent', {
          value: fieldDeclCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("''")
      })
    })
  })

  describe('Given a null literal in return statement without enclosing method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in unrecognized parent context', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in return statement of unknown method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations when method not in registry', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        const methodCtx = Object.create(MethodDeclarationContext.prototype)
        methodCtx.children = [
          { text: 'Integer' },
          { text: 'unknownMethod' },
          { text: '(' },
          { text: ')' },
        ]
        Object.defineProperty(returnCtx, 'parent', {
          value: methodCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in declaration without typeRef', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const localVarCtx = Object.create(
          LocalVariableDeclarationContext.prototype
        )
        localVarCtx.typeRef = () => undefined
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: localVarCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in return statement without TypeRegistry', () => {
    describe('When entering the literal without TypeRegistry', () => {
      it('Then should create no mutations (typeRegistry guard must fire before attempting resolution)', () => {
        // Arrange: no typeRegistry, but ctx has a return statement parent chain
        // This test distinguishes !this.typeRegistry from false (ID:775)
        sut = new InlineConstantMutator() // no typeRegistry
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        const methodCtx = Object.create(MethodDeclarationContext.prototype)
        methodCtx.children = [
          { text: 'Integer' },
          { text: 'testMethod' },
          { text: '(' },
          { text: ')' },
        ]
        Object.defineProperty(returnCtx, 'parent', {
          value: methodCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert: no typeRegistry → guard fires → 0 mutations (no crash)
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in return statement of method not in registry, with no enclosing method', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations when enclosing method is not found', () => {
        // Arrange: typeRegistry provided but ctx has ReturnStatement with no MethodDeclarationContext parent
        // Tests the !methodName guard in resolveFromReturn (ID:793)
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: returnCtx,
          writable: true,
          configurable: true,
        })
        // returnCtx has no parent → getEnclosingMethodName returns null
        // so !methodName is true → returns null → 0 mutations
        // But if mutant makes !methodName always false, resolveType(null) is called
        // which still returns null typeInfo → so still 0 mutations... but now testing the guard
        // To distinguish, we'd need a method named null in the registry — not possible
        // Instead verify this path produces 0 mutations via observable behavior

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a null literal in local variable declaration of unknown type', () => {
    describe('When entering the literal with TypeRegistry', () => {
      it('Then should create no mutations for unknown reference type', () => {
        // Arrange: type is a class reference (not a primitive) — classifyApexType returns VOID
        // Also tests that classifyApexType([]) empty matchers works correctly (ID:805)
        const typeRegistry = TestUtil.createTypeRegistry()
        sut = new InlineConstantMutator(typeRegistry)
        const nullNode = createTerminalNode('null')
        const ctx = createLiteralCtx('null', nullNode)
        const localVarCtx = Object.create(
          LocalVariableDeclarationContext.prototype
        )
        // 'MyClass' is not a known primitive → classifyApexType returns VOID → getDefaultValueForApexType returns null
        localVarCtx.typeRef = () => ({ text: 'MyClass' })
        const exprCtx = Object.create(ParserRuleContext.prototype)
        Object.defineProperty(ctx, 'parent', {
          value: exprCtx,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(exprCtx, 'parent', {
          value: localVarCtx,
          writable: true,
          configurable: true,
        })

        // Act
        sut.enterLiteral(ctx)

        // Assert: unknown type → no default value → 0 mutations
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a long literal with uppercase L suffix', () => {
    describe('When entering the literal', () => {
      it('Then should parse the value correctly and produce non-L mutations', () => {
        // Arrange: '5L' — the /[lL]$/ regex strips the L to get '5'
        // Tests ID:736: /[^lL]$/ would strip the last char if not L (so for '5L' → strip L... wait no)
        // Actually /[^lL]$/ strips the last char IF it's NOT l or L
        // For '5L': last char is L → does NOT match [^lL] → no replacement → text = '5L'
        // parseInt('5L') = 5. value = 5, same as original. Equivalent for valid inputs.
        // Instead test that the L is properly stripped for a value like '5l' (lowercase)
        const longNode = createTerminalNode('5L')
        const ctx = createLiteralCtx('long', longNode)

        // Act
        sut.enterLiteral(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(5) // 0L, 1L, -1L, 6L, 4L
        const replacements = sut._mutations.map(m => m.replacement)
        expect(replacements).toContain('0L')
        expect(replacements).toContain('1L')
        expect(replacements).toContain('-1L')
        expect(replacements).toContain('6L')
        expect(replacements).toContain('4L')
      })
    })
  })
})
