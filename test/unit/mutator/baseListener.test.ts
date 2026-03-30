import { ParserRuleContext, Token } from 'antlr4ts'
import { TerminalNode } from 'antlr4ts/tree/index.js'
import { MethodDeclarationContext, ReturnStatementContext } from 'apex-parser'
import { BaseListener } from '../../../src/mutator/baseListener.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

class TestableBaseListener extends BaseListener {
  getEnclosingMethodNamePublic(ctx: ParserRuleContext): string | null {
    return this.getEnclosingMethodName(ctx)
  }

  isInsideReturnStatementPublic(ctx: ParserRuleContext): boolean {
    return this.isInsideReturnStatement(ctx)
  }

  isNonNumericContextPublic(ctx: ParserRuleContext): boolean {
    return this.isNonNumericContext(ctx)
  }

  createMutationPublic(
    startToken: Token,
    endToken: Token,
    originalText: string,
    replacement: string
  ): void {
    this.createMutation(startToken, endToken, originalText, replacement)
  }

  createMutationFromParserRuleContextPublic(
    ctx: ParserRuleContext,
    replacement: string
  ): void {
    this.createMutationFromParserRuleContext(ctx, replacement)
  }

  createMutationFromTerminalNodePublic(
    node: TerminalNode,
    replacement: string
  ): void {
    this.createMutationFromTerminalNode(node, replacement)
  }

  get exposedTypeRegistry(): TypeRegistry | undefined {
    return this.typeRegistry
  }
}

function setParent(child: ParserRuleContext, parent: ParserRuleContext): void {
  Object.defineProperty(child, 'parent', {
    value: parent,
    writable: true,
    configurable: true,
  })
}

describe('BaseListener', () => {
  describe('constructor', () => {
    it('Given no arguments, When constructing, Then typeRegistry is undefined', () => {
      // Arrange & Act
      const listener = new TestableBaseListener()

      // Assert
      expect(listener.exposedTypeRegistry).toBeUndefined()
    })

    it('Given a TypeRegistry, When constructing, Then typeRegistry is set', () => {
      // Arrange
      const registry = new TypeRegistry(new Map(), new Map(), new Map(), [])

      // Act
      const listener = new TestableBaseListener(registry)

      // Assert
      expect(listener.exposedTypeRegistry).toBe(registry)
    })
  })

  describe('getEnclosingMethodName', () => {
    it('Given a context with a MethodDeclarationContext ancestor, When calling getEnclosingMethodName, Then returns the method name', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'myMethod' },
        { text: '(' },
        { text: ')' },
      ]

      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, methodCtx)

      // Act
      const result = listener.getEnclosingMethodNamePublic(innerCtx)

      // Assert
      expect(result).toBe('myMethod')
    })

    it('Given a context with a deeply nested MethodDeclarationContext ancestor, When calling getEnclosingMethodName, Then returns the method name', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Integer' },
        { text: 'deepMethod' },
        { text: '(' },
        { text: ')' },
      ]

      const middleCtx = new ParserRuleContext()
      setParent(middleCtx, methodCtx)

      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, middleCtx)

      // Act
      const result = listener.getEnclosingMethodNamePublic(innerCtx)

      // Assert
      expect(result).toBe('deepMethod')
    })

    it('Given a context with no MethodDeclarationContext ancestor, When calling getEnclosingMethodName, Then returns null', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const rootCtx = new ParserRuleContext()
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, rootCtx)

      // Act
      const result = listener.getEnclosingMethodNamePublic(innerCtx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a context with no parent, When calling getEnclosingMethodName, Then returns null', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const ctx = new ParserRuleContext()

      // Act
      const result = listener.getEnclosingMethodNamePublic(ctx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a MethodDeclarationContext with no children, When calling getEnclosingMethodName, Then returns null', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = undefined

      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, methodCtx)

      // Act
      const result = listener.getEnclosingMethodNamePublic(innerCtx)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('createMutation', () => {
    it('Given valid tokens, When creating a mutation, Then mutation is added to _mutations', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const startToken = TestUtil.createToken(1, 0)
      const endToken = TestUtil.createToken(1, 5)

      // Act
      listener.createMutationPublic(
        startToken,
        endToken,
        'original',
        'replacement'
      )

      // Assert
      expect(listener._mutations).toHaveLength(1)
      expect(listener._mutations[0].replacement).toBe('replacement')
      expect(listener._mutations[0].target.text).toBe('original')
    })
  })

  describe('createMutationFromParserRuleContext', () => {
    it('Given context with both start and stop tokens, When creating mutation, Then mutation is added', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const ctx = {
        start: TestUtil.createToken(1, 0),
        stop: TestUtil.createToken(1, 5),
        text: 'original',
      } as unknown as ParserRuleContext

      // Act
      listener.createMutationFromParserRuleContextPublic(ctx, 'replacement')

      // Assert
      expect(listener._mutations).toHaveLength(1)
      expect(listener._mutations[0].replacement).toBe('replacement')
      expect(listener._mutations[0].target.text).toBe('original')
    })

    it('Given context with missing start token, When creating mutation, Then no mutation is added', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const ctx = {
        start: null,
        stop: TestUtil.createToken(1, 5),
        text: 'original',
      } as unknown as ParserRuleContext

      // Act
      listener.createMutationFromParserRuleContextPublic(ctx, 'replacement')

      // Assert
      expect(listener._mutations).toHaveLength(0)
    })

    it('Given context with missing stop token, When creating mutation, Then no mutation is added', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const ctx = {
        start: TestUtil.createToken(1, 0),
        stop: null,
        text: 'original',
      } as unknown as ParserRuleContext

      // Act
      listener.createMutationFromParserRuleContextPublic(ctx, 'replacement')

      // Assert
      expect(listener._mutations).toHaveLength(0)
    })
  })

  describe('createMutationFromTerminalNode', () => {
    it('Given terminal node with a symbol, When creating mutation, Then mutation is added', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const symbol = TestUtil.createToken(1, 3)
      const node = {
        symbol,
        text: 'original',
      } as unknown as TerminalNode

      // Act
      listener.createMutationFromTerminalNodePublic(node, 'replacement')

      // Assert
      expect(listener._mutations).toHaveLength(1)
      expect(listener._mutations[0].replacement).toBe('replacement')
      expect(listener._mutations[0].target.text).toBe('original')
    })

    it('Given terminal node with missing symbol, When creating mutation, Then no mutation is added', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const node = {
        symbol: null,
        text: 'original',
      } as unknown as TerminalNode

      // Act
      listener.createMutationFromTerminalNodePublic(node, 'replacement')

      // Assert
      expect(listener._mutations).toHaveLength(0)
    })
  })

  describe('isInsideReturnStatement', () => {
    it('Given a context directly inside a ReturnStatementContext, When isInsideReturnStatement, Then returns true', () => {
      // Arrange — kills `instanceof ReturnStatementContext → true` ConditionalExpression mutant:
      // With mutant `false`, the check always returns false, never detecting return contexts.
      const listener = new TestableBaseListener()
      const returnCtx = Object.create(ReturnStatementContext.prototype)
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, returnCtx)

      // Act
      const result = listener.isInsideReturnStatementPublic(innerCtx)

      // Assert
      expect(result).toBe(true)
    })

    it('Given a context with no ReturnStatementContext ancestor, When isInsideReturnStatement, Then returns false', () => {
      // Arrange — verifies the false-return path when no return statement ancestor exists
      const listener = new TestableBaseListener()
      const rootCtx = new ParserRuleContext()
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, rootCtx)

      // Act
      const result = listener.isInsideReturnStatementPublic(innerCtx)

      // Assert
      expect(result).toBe(false)
    })

    it('Given a context deeply nested inside a ReturnStatementContext, When isInsideReturnStatement, Then returns true', () => {
      // Arrange — walks up multiple levels to find ReturnStatementContext
      const listener = new TestableBaseListener()
      const returnCtx = Object.create(ReturnStatementContext.prototype)
      const middleCtx = new ParserRuleContext()
      setParent(middleCtx, returnCtx)
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, middleCtx)

      // Act
      const result = listener.isInsideReturnStatementPublic(innerCtx)

      // Assert
      expect(result).toBe(true)
    })

    it('Given a context with no parent, When isInsideReturnStatement, Then returns false', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const ctx = new ParserRuleContext()

      // Act
      const result = listener.isInsideReturnStatementPublic(ctx)

      // Assert
      expect(result).toBe(false)
    })

    it('Given a non-ReturnStatementContext parent with prototype matching ParserRuleContext, When isInsideReturnStatement, Then returns false (kills instanceof → true mutant)', () => {
      // Arrange — kills `instanceof ReturnStatementContext → true` mutant:
      // With true, every parent is treated as a return statement, so any context would return true.
      // This test ensures a plain ParserRuleContext parent returns false.
      const listener = new TestableBaseListener()
      const nonReturnCtx = new ParserRuleContext()
      const innerCtx = new ParserRuleContext()
      setParent(innerCtx, nonReturnCtx)

      // Act
      const result = listener.isInsideReturnStatementPublic(innerCtx)

      // Assert — plain ParserRuleContext is not a ReturnStatementContext
      expect(result).toBe(false)
    })
  })

  describe('isNonNumericContext', () => {
    function createBinaryCtx(
      leftText: string,
      rightText: string
    ): ParserRuleContext {
      return {
        getChild: (index: number) => {
          if (index === 0) return { text: leftText }
          if (index === 2) return { text: rightText }
          return { text: '+' }
        },
      } as unknown as ParserRuleContext
    }

    it('Given left operand with string literal (contains apostrophe), When isNonNumericContext, Then returns true', () => {
      // Arrange — kills the || → && mutant: left is string, right is numeric
      const listener = new TestableBaseListener()
      const ctx = createBinaryCtx("'hello'", 'count')

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(true)
    })

    it('Given right operand with string literal (contains apostrophe), When isNonNumericContext, Then returns true', () => {
      // Arrange — kills the || → && mutant: left is numeric, right is string literal
      const listener = new TestableBaseListener()
      const ctx = createBinaryCtx('count', "'world'")

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(true)
    })

    it('Given no typeRegistry, When isNonNumericContext, Then returns false', () => {
      // Arrange
      const listener = new TestableBaseListener()
      const ctx = createBinaryCtx('x', 'y')

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(false)
    })

    it('Given typeRegistry but no enclosing method, When isNonNumericContext, Then returns false', () => {
      // Arrange
      const registry = new TypeRegistry(new Map(), new Map(), new Map(), [])
      const listener = new TestableBaseListener(registry)
      const ctx = createBinaryCtx('x', 'y')
      // No parent — getEnclosingMethodName returns null

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(false)
    })

    it('Given typeRegistry, enclosing method, both operands numeric, When isNonNumericContext, Then returns false', () => {
      // Arrange
      const variableScopes = new Map([
        [
          'testMethod',
          new Map([
            ['x', 'integer'],
            ['y', 'integer'],
          ]),
        ],
      ])
      const registry = new TypeRegistry(
        new Map(),
        variableScopes,
        new Map(),
        []
      )
      const listener = new TestableBaseListener(registry)

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const ctx = createBinaryCtx('x', 'y')
      setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(false)
    })

    it('Given typeRegistry, enclosing method, left operand String right numeric, When isNonNumericContext, Then returns true (kills || → && mutant)', () => {
      // Arrange — kills || → && mutant: exactly one operand non-numeric on the left side
      const variableScopes = new Map([
        [
          'testMethod',
          new Map([
            ['name', 'string'],
            ['count', 'integer'],
          ]),
        ],
      ])
      const registry = new TypeRegistry(
        new Map(),
        variableScopes,
        new Map(),
        []
      )
      const listener = new TestableBaseListener(registry)

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const ctx = createBinaryCtx('name', 'count')
      setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(true)
    })

    it('Given typeRegistry, enclosing method, left operand numeric right String, When isNonNumericContext, Then returns true (kills || → && mutant)', () => {
      // Arrange — kills || → && mutant: exactly one operand non-numeric on the right side
      const variableScopes = new Map([
        [
          'testMethod',
          new Map([
            ['count', 'integer'],
            ['suffix', 'string'],
          ]),
        ],
      ])
      const registry = new TypeRegistry(
        new Map(),
        variableScopes,
        new Map(),
        []
      )
      const listener = new TestableBaseListener(registry)

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const ctx = createBinaryCtx('count', 'suffix')
      setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = listener.isNonNumericContextPublic(ctx)

      // Assert
      expect(result).toBe(true)
    })
  })
})
