import { ParserRuleContext } from 'antlr4ts'
import {
  DotMethodCallContext,
  ExpressionListContext,
  MethodDeclarationContext,
} from 'apex-parser'
import {
  extractArguments,
  getEnclosingMethodName,
  resolveDotMethodCall,
  resolveExpressionApexType,
} from '../../../src/mutator/astUtils.js'
import { APEX_TYPE, type ApexMethod } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('astUtils', () => {
  describe('getEnclosingMethodName', () => {
    it('Given a context with a MethodDeclarationContext parent, When called, Then returns the method name', () => {
      // Arrange
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'String' },
        { text: 'myMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, methodCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBe('myMethod')
    })

    it('Given a deeply nested context, When called, Then walks up to find method name', () => {
      // Arrange
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'Integer' },
        { text: 'deepMethod' },
        { text: '(' },
        { text: ')' },
      ]
      const middleCtx = new ParserRuleContext()
      TestUtil.setParent(middleCtx, methodCtx)
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, middleCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBe('deepMethod')
    })

    it('Given a context with no MethodDeclarationContext ancestor, When called, Then returns null', () => {
      // Arrange
      const rootCtx = new ParserRuleContext()
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, rootCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a context with no parent, When called, Then returns null', () => {
      // Arrange
      const ctx = new ParserRuleContext()

      // Act
      const result = getEnclosingMethodName(ctx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a MethodDeclarationContext with no children, When called, Then returns null', () => {
      // Arrange
      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = undefined
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, methodCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a non-MethodDeclarationContext parent with children[1] having text, When called, Then returns null', () => {
      // Arrange
      // Kills the `instanceof MethodDeclarationContext → true` mutant.
      // With `true`, every parent is treated as a MethodDeclarationContext.
      // If the parent (a plain ParserRuleContext) has children[1].text defined,
      // the mutant would return that text instead of null.
      const nonMethodCtx = new ParserRuleContext()
      // Give the plain ParserRuleContext a children array with a defined [1].text
      Object.defineProperty(nonMethodCtx, 'children', {
        value: [{ text: 'String' }, { text: 'shouldNotReturn' }, { text: '(' }],
        writable: true,
        configurable: true,
      })
      const innerCtx = new ParserRuleContext()
      TestUtil.setParent(innerCtx, nonMethodCtx)

      // Act
      const result = getEnclosingMethodName(innerCtx)

      // Assert — parent is not a MethodDeclarationContext, so must return null
      expect(result).toBeNull()
    })
  })

  describe('resolveDotMethodCall', () => {
    it('Given a valid dot expression with known method, When called, Then returns DotMethodCallInfo', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')

      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).not.toBeNull()
      expect(result!.methodName).toBe('transform')
      expect(result!.enclosingMethod).toBe('testMethod')
      expect(result!.returnType.apexType).toBe(APEX_TYPE.STRING)
    })

    it('Given a context with fewer than 3 children, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const ctx = {
        children: [{ text: 'obj' }],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a context with null children, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a dot expression where last child is not DotMethodCallContext, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, { text: 'field' }],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a DotMethodCallContext with insufficient children, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: [{ text: 'method' }],
        writable: true,
        configurable: true,
      })
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given no enclosing method, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a method not in typeTable, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()
      const dotMethodCall = TestUtil.createDotMethodCallCtx('unknownMethod')
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a context with exactly 2 children where last is DotMethodCallContext, When called, Then returns null', () => {
      // Arrange
      // Kills `ctx.children.length < 3 → < 2` mutant (and similar weakened comparisons).
      // With original `< 3`: 2 < 3 = true → returns null (correct).
      // With `< 2`: 2 < 2 = false → proceeds; last child IS DotMethodCallContext with valid
      // children, enclosing method exists and type resolves → returns non-null (wrong).
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')

      const ctx = {
        children: [{ text: 'obj' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert — 2 children is fewer than 3, must return null
      expect(result).toBeNull()
    })

    it('Given a context with 4 children where last is DotMethodCallContext, When called, Then returns DotMethodCallInfo', () => {
      // Arrange
      // Kills `ctx.children.length < 3 → > 3` mutant: 4 > 3 = true → returns null (wrong).
      // With original `< 3`: 4 < 3 = false → proceeds and returns valid info (correct).
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')

      const ctx = {
        children: [
          { text: 'obj' },
          { text: '.' },
          { text: 'extra' },
          dotMethodCall,
        ],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert — 4 children, last is DotMethodCallContext, valid method → must return info
      expect(result).not.toBeNull()
      expect(result!.methodName).toBe('transform')
    })

    it('Given no enclosing method but typeRegistry knows the method, When called, Then returns null', () => {
      // Arrange
      // Kills `!enclosingMethod → false` mutant.
      // With the mutant, the guard is skipped. resolveType(null, 'transform()') still resolves
      // to STRING (methodName in typeTable). Returns non-null info instead of null.
      // With original `!enclosingMethod`: null is falsy → returns null (correct).
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)
      const dotMethodCall = TestUtil.createDotMethodCallCtx('transform')
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext
      // No parent — getEnclosingMethodName returns null

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert — no enclosing method means we cannot resolve context → must return null
      expect(result).toBeNull()
    })

    it('Given a DotMethodCallContext with null children, When called, Then returns null', () => {
      // Arrange
      // Kills `!lastChild.children → false` mutant: with the mutant, the null-children guard
      // is skipped, then `null.length < 3` throws instead of returning null.
      // This test exercises the !lastChild.children path directly.
      const typeRegistry = TestUtil.createTypeRegistry()
      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: null,
        writable: true,
        configurable: true,
      })
      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert
      expect(result).toBeNull()
    })

    it('Given a DotMethodCallContext with exactly 2 children and enclosing method with known type, When called, Then returns null', () => {
      // Arrange
      // Kills `lastChild.children.length < 3 → < 2` mutant AND `|| → &&` on the lastChild guard.
      // With `< 3`: 2 < 3 = true → returns null (correct).
      // With `< 2`: 2 < 2 = false → proceeds; gets methodName, enclosing method, resolves type → returns non-null (wrong).
      // With `|| → &&` on `!lastChild.children || length < 3`:
      //   !children = false (children is non-null), && short-circuits to false → doesn't return early
      //   → proceeds with 2 children, length 2 >= 3 is false for `< 3` check, wait this is the INNER check
      // Actually the `|| → &&` mutant here changes: `!lastChild.children || lastChild.children.length < 3`
      //   to `!lastChild.children && lastChild.children.length < 3`.
      //   With non-null children (length=2): `false && 2 < 3 = false` → doesn't return early
      //   → proceeds, methodName = children[0].text, enclosingMethod = 'testMethod',
      //   resolveType = STRING → returns non-null. Test expects null → caught!
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)

      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: [{ text: 'transform' }, { text: '(' }],
        writable: true,
        configurable: true,
      })

      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert — DotMethodCallContext with only 2 children is insufficient → null
      expect(result).toBeNull()
    })

    it('Given a DotMethodCallContext with 1 child and enclosing method with known type, When called, Then returns null', () => {
      // Arrange
      // Kills `lastChild.children.length < 3 → > 3` mutant.
      // With `> 3`: 1 > 3 = false → doesn't return early → proceeds;
      // methodName = children[0].text, getEnclosingMethodName succeeds,
      // resolveType returns STRING → returns non-null (wrong).
      // With original `< 3`: 1 < 3 = true → returns null (correct).
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: APEX_TYPE.STRING,
      })
      const typeRegistry = TestUtil.createTypeRegistry(typeTable)

      const dotMethodCall = Object.create(DotMethodCallContext.prototype)
      Object.defineProperty(dotMethodCall, 'children', {
        value: [{ text: 'transform' }],
        writable: true,
        configurable: true,
      })

      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
      } as unknown as ParserRuleContext

      const methodCtx = Object.create(MethodDeclarationContext.prototype)
      methodCtx.children = [
        { text: 'void' },
        { text: 'testMethod' },
        { text: '(' },
        { text: ')' },
      ]
      TestUtil.setParent(ctx as ParserRuleContext, methodCtx)

      // Act
      const result = resolveDotMethodCall(ctx, typeRegistry)

      // Assert — DotMethodCallContext with only 1 child is insufficient → null
      expect(result).toBeNull()
    })
  })

  describe('extractArguments', () => {
    it('Given a method call with arguments, When called, Then returns argument nodes', () => {
      // Arrange
      const arg1 = TestUtil.createArgNode('x')
      const arg2 = TestUtil.createArgNode('y')
      const methodCallCtx = TestUtil.createDotMethodCallCtx('method', [
        arg1,
        arg2,
      ])

      // Act
      const result = extractArguments(methodCallCtx)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('x')
      expect(result[1].text).toBe('y')
    })

    it('Given a method call with no arguments, When called, Then returns empty array', () => {
      // Arrange
      const methodCallCtx = TestUtil.createDotMethodCallCtx('method')

      // Act
      const result = extractArguments(methodCallCtx)

      // Assert
      expect(result).toHaveLength(0)
    })

    it('Given a method call with null children, When called, Then returns empty array', () => {
      // Arrange
      const ctx = { children: null } as unknown as ParserRuleContext

      // Act
      const result = extractArguments(ctx)

      // Assert
      expect(result).toHaveLength(0)
    })

    it('Given an ExpressionListContext with null children, When called, Then returns empty array', () => {
      // Arrange
      const expressionList = Object.create(ExpressionListContext.prototype)
      Object.defineProperty(expressionList, 'children', {
        value: null,
        writable: true,
        configurable: true,
      })
      const ctx = {
        children: [
          { text: 'method' },
          { text: '(' },
          expressionList,
          { text: ')' },
        ],
      } as unknown as ParserRuleContext

      // Act
      const result = extractArguments(ctx)

      // Assert
      expect(result).toHaveLength(0)
    })
  })

  describe('resolveExpressionApexType', () => {
    it('Given an integer literal, When called, Then returns INTEGER', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('42', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.INTEGER)
    })

    it('Given a long literal with uppercase suffix, When called, Then returns LONG', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('5L', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.LONG)
    })

    it('Given a long literal with lowercase suffix, When called, Then returns LONG', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('5l', 'testMethod', typeRegistry)

      // Assert
      expect(result).toBe(APEX_TYPE.LONG)
    })

    it('Given a decimal numeric literal, When called, Then returns DOUBLE', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const sut = resolveExpressionApexType('3.14', 'testMethod', typeRegistry)

      // Assert
      expect(sut).toBe(APEX_TYPE.DOUBLE)
    })

    it('Given a numeric literal with trailing zero decimal, When called, Then returns DOUBLE', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const sut = resolveExpressionApexType('5.0', 'testMethod', typeRegistry)

      // Assert
      expect(sut).toBe(APEX_TYPE.DOUBLE)
    })

    it('Given a string literal, When called, Then returns STRING', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        "'hello'",
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.STRING)
    })

    it('Given true, When called, Then returns BOOLEAN', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'true',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.BOOLEAN)
    })

    it('Given false, When called, Then returns BOOLEAN', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'false',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.BOOLEAN)
    })

    it('Given FALSE (case insensitive), When called, Then returns BOOLEAN', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'FALSE',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.BOOLEAN)
    })

    it('Given a variable known to typeRegistry, When called, Then returns its type', () => {
      // Arrange
      const variableScopes = new Map([
        ['testMethod', new Map([['input', 'string']])],
      ])
      const typeRegistry = TestUtil.createTypeRegistry(
        new Map(),
        variableScopes
      )

      // Act
      const result = resolveExpressionApexType(
        'input',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.STRING)
    })

    it('Given an unknown variable, When called, Then returns null', () => {
      // Arrange
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'unknown',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBeNull()
    })

    it('Given text with digit not at start (e.g. a1b), When called, Then does not classify as numeric', () => {
      // Arrange — kills /^\d/ → /\d/ anchor removal mutant: /\d/ matches 'a1b' but /^\d/ does not
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'a1b',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBeNull()
    })

    it('Given numeric literal with L in the middle (12L34), When called, Then returns INTEGER not LONG', () => {
      // Arrange — kills /L$/ → /L/ anchor removal mutant: /L/ matches '12L34' but /L$/ does not
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        '12L34',
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.INTEGER)
    })

    it("Given text starting with quote but not ending with one ('hello), When called, Then returns STRING", () => {
      // Arrange — kills startsWith("'") → endsWith("'") mutant:
      //   endsWith does not match "'hello" (ends with 'o'), but startsWith does
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        "'hello",
        'testMethod',
        typeRegistry
      )

      // Assert
      expect(result).toBe(APEX_TYPE.STRING)
    })

    it('Given text that starts with a digit and is neither long nor double, When called, Then returns INTEGER not null', () => {
      // Arrange — kills `if (/^\d/.test(text)) { ... } → if (false)` ConditionalExpression mutant:
      // With if(false), the block is skipped entirely and '42' falls through to string/boolean checks
      // returning null instead of INTEGER.
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('42', 'testMethod', typeRegistry)

      // Assert — must return INTEGER, not null
      expect(result).toBe(APEX_TYPE.INTEGER)
      expect(result).not.toBeNull()
    })

    it('Given text starting with digit followed by L (long literal), When called, Then returns LONG not null', () => {
      // Arrange — kills inner `if (/L$/i.test(text)) return LONG` ConditionalExpression (→ false):
      // With false, 5L would skip LONG check and fall to `.includes('.')` check returning INTEGER.
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType('5L', 'testMethod', typeRegistry)

      // Assert — must return LONG, not INTEGER
      expect(result).toBe(APEX_TYPE.LONG)
      expect(result).not.toBe(APEX_TYPE.INTEGER)
    })

    it('Given true string, When called, Then returns BOOLEAN not null (kills lower === true || false → false ConditionalExpression)', () => {
      // Arrange — kills `lower === 'true' || lower === 'false'` → `false` ConditionalExpression mutant:
      // With false, 'true' falls through to typeRegistry lookup which returns null.
      const typeRegistry = TestUtil.createTypeRegistry()

      // Act
      const result = resolveExpressionApexType(
        'true',
        'testMethod',
        typeRegistry
      )

      // Assert — must return BOOLEAN, not null
      expect(result).toBe(APEX_TYPE.BOOLEAN)
      expect(result).not.toBeNull()
    })
  })
})
