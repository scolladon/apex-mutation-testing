import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext } from 'apex-parser'
import { BaseListener } from '../../../src/mutator/baseListener.js'
import { TypeRegistry } from '../../../src/type/TypeRegistry.js'
import { TestUtil } from '../../utils/testUtil.js'

class TestableBaseListener extends BaseListener {
  getEnclosingMethodNamePublic(ctx: ParserRuleContext): string | null {
    return this.getEnclosingMethodName(ctx)
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
      listener['createMutation'](
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
})
