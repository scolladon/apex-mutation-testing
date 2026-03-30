import { ParserRuleContext } from 'antlr4ts'
import { MethodDeclarationContext, ReturnStatementContext } from 'apex-parser'
import { UnaryOperatorInsertionMutator } from '../../../src/mutator/unaryOperatorInsertionMutator.js'
import { TestUtil } from '../../utils/testUtil.js'

function createMethodParent(methodName: string): ParserRuleContext {
  const methodCtx = Object.create(MethodDeclarationContext.prototype)
  methodCtx.children = [
    { text: 'void' },
    { text: methodName },
    { text: '(' },
    { text: ')' },
  ]
  return methodCtx
}

const createPrimaryExpression = (
  text: string,
  options?: { withTokens?: boolean; childIsParserRule?: boolean }
) => {
  const { withTokens = true, childIsParserRule = true } = options ?? {}

  const primary = childIsParserRule
    ? (() => {
        const node = {
          text,
          childCount: 0,
          children: [],
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(node, ParserRuleContext.prototype)
        return node
      })()
    : { text }

  return {
    childCount: 1,
    text,
    start: withTokens ? TestUtil.createToken(1, 0) : null,
    stop: withTokens ? TestUtil.createToken(1, text.length) : null,
    getChild: (index: number) => (index === 0 ? primary : null),
  } as unknown as ParserRuleContext
}

describe('UnaryOperatorInsertionMutator', () => {
  let sut: UnaryOperatorInsertionMutator

  beforeEach(() => {
    sut = new UnaryOperatorInsertionMutator()
  })

  describe('Given a primary expression with a variable identifier', () => {
    describe('When entering the expression', () => {
      it('Then should create 4 mutations (x++, ++x, x--, --x)', () => {
        // Arrange
        const ctx = createPrimaryExpression('counter')

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
        expect(sut._mutations[0].replacement).toBe('counter++')
        expect(sut._mutations[1].replacement).toBe('++counter')
        expect(sut._mutations[2].replacement).toBe('counter--')
        expect(sut._mutations[3].replacement).toBe('--counter')
      })
    })
  })

  describe('Given a primary expression with a number literal', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression('42')

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with a string literal', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression("'hello'")

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with boolean/null literals', () => {
    describe('When entering the expression', () => {
      it.each([
        'true',
        'false',
        'null',
      ])('Then should not create mutations for %s', literal => {
        // Arrange
        const ctx = createPrimaryExpression(literal)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with this/super', () => {
    describe('When entering the expression', () => {
      it.each([
        'this',
        'super',
      ])('Then should not create mutations for %s', keyword => {
        // Arrange
        const ctx = createPrimaryExpression(keyword)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression with multiple children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 2,
          getChild: () => ({}),
        } as unknown as ParserRuleContext

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression where child is not ParserRuleContext', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression('x', {
          childIsParserRule: false,
        })

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a primary expression without start/stop tokens', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = createPrimaryExpression('x', { withTokens: false })

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given mutations metadata', () => {
    it('Then mutationName should be UnaryOperatorInsertionMutator', () => {
      // Arrange
      const ctx = createPrimaryExpression('x')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(4)
      sut._mutations.forEach(mutation => {
        expect(mutation.mutationName).toBe('UnaryOperatorInsertionMutator')
      })
    })
  })

  describe('Given a primary expression with a non-numeric type and TypeRegistry', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations for String variable', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map(),
          new Map([['testMethod', new Map([['s', 'string']])]])
        )
        const sut = new UnaryOperatorInsertionMutator(typeRegistry)
        const ctx = createPrimaryExpression('s')
        const methodCtx = createMethodParent('testMethod')
        TestUtil.setParent(ctx, methodCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })

      it('Then should not create any mutations for Boolean variable', () => {
        // Arrange — exercises the non-numeric typeRegistry path with a Boolean type.
        // Kills `if (this.typeRegistry)` → `if (true)` mutant combined with the
        // "without TypeRegistry" test: when typeRegistry IS present and the variable
        // resolves to Boolean (non-numeric), mutations are suppressed.
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map(),
          new Map([['testMethod', new Map([['flag', 'boolean']])]])
        )
        const sut = new UnaryOperatorInsertionMutator(typeRegistry)
        const ctx = createPrimaryExpression('flag')
        const methodCtx = createMethodParent('testMethod')
        TestUtil.setParent(ctx, methodCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given no TypeRegistry but an enclosing method context', () => {
    describe('When entering the expression', () => {
      it('Then should create 4 mutations (typeRegistry absent → skips isNumericOperand check)', () => {
        // Arrange — typeRegistry is absent but ctx HAS an enclosing method.
        // With mutant `if (this.typeRegistry)` → `if (true)`:
        // `this.typeRegistry.isNumericOperand(...)` crashes (typeRegistry is undefined).
        // Original: guard is false → skips body → creates 4 mutations.
        const sut = new UnaryOperatorInsertionMutator() // no typeRegistry
        const ctx = createPrimaryExpression('counter')
        const methodCtx = createMethodParent('testMethod')
        TestUtil.setParent(ctx, methodCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
      })
    })
  })

  describe('Given TypeRegistry and enclosing method but variable not in scope', () => {
    describe('When entering the expression', () => {
      it('Then should create 4 mutations (isNumericOperand returns true for unresolved identifier)', () => {
        // Arrange — typeRegistry exists and has a method scope, but the variable 'unknownVar'
        // is not declared there. isNumericOperand returns true (permissive fallback) →
        // the guard `!isNumericOperand(...)` is false → does not return early → 4 mutations.
        // This kills `if (methodName && !this.typeRegistry.isNumericOperand(...))` → `if (true)` mutant:
        // the mutant would unconditionally return early even for unresolved variables → 0 mutations.
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map(),
          new Map([['testMethod', new Map([['knownVar', 'string']])]])
        )
        const sut = new UnaryOperatorInsertionMutator(typeRegistry)
        const ctx = createPrimaryExpression('unknownVar')
        const methodCtx = createMethodParent('testMethod')
        TestUtil.setParent(ctx, methodCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
      })
    })
  })

  describe('Given TypeRegistry and no enclosing method context', () => {
    describe('When entering the expression', () => {
      it('Then should create 4 mutations (methodName is null → skips isNumericOperand call)', () => {
        // Arrange — typeRegistry present but no parent MethodDeclaration → methodName=null.
        // With mutant `methodName && !...` → `true && !...` or `!...` alone: would call
        // isNumericOperand(null, 'x') which returns true → !true = false → no early return → 4 mutations (same).
        // BUT with mutant `methodName && ...` → `methodName || ...`: when methodName=null,
        // `null || !isNumericOperand(null, 'x')` = `!true` = false → no early return → 4 mutations (same).
        // This test documents the expected behavior to help Stryker detect any deviations.
        const typeRegistry = TestUtil.createTypeRegistry()
        const sut = new UnaryOperatorInsertionMutator(typeRegistry)
        const ctx = createPrimaryExpression('x')
        // No parent set → methodName = null

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
      })
    })
  })

  describe('Given a primary expression with a numeric type and TypeRegistry', () => {
    describe('When entering the expression', () => {
      it.each([
        'integer',
        'long',
        'double',
        'decimal',
      ])('Then should create 4 mutations for %s variable', typeName => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry(
          new Map(),
          new Map([['testMethod', new Map([['x', typeName]])]])
        )
        const sut = new UnaryOperatorInsertionMutator(typeRegistry)
        const ctx = createPrimaryExpression('x')
        const methodCtx = createMethodParent('testMethod')
        TestUtil.setParent(ctx, methodCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
      })
    })
  })

  describe('Given a primary expression with unresolvable type and TypeRegistry', () => {
    describe('When entering the expression', () => {
      it('Then should still create 4 mutations (permissive fallback)', () => {
        // Arrange
        const typeRegistry = TestUtil.createTypeRegistry()
        const sut = new UnaryOperatorInsertionMutator(typeRegistry)
        const ctx = createPrimaryExpression('unknown')
        const methodCtx = createMethodParent('testMethod')
        TestUtil.setParent(ctx, methodCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
      })
    })
  })

  describe('Given a primary expression without TypeRegistry', () => {
    describe('When entering the expression', () => {
      it('Then should still create 4 mutations (permissive fallback)', () => {
        // Arrange
        const ctx = createPrimaryExpression('anyVar')

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(4)
      })
    })
  })

  describe('Given a primary expression with uppercase boolean/null literals', () => {
    describe('When entering the expression', () => {
      it.each([
        'TRUE',
        'FALSE',
        'NULL',
        'True',
        'False',
        'Null',
      ])('Then should not create mutations for %s (case-insensitive)', literal => {
        // Arrange
        const ctx = createPrimaryExpression(literal)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given isLiteral: only true is a known keyword, When false and null are different keywords, Then each independently triggers early return', () => {
    it('Given "false" identifier alone, Then should not create mutations', () => {
      // Arrange — kills lower==="true" && lower==="false" || ... mutation where "false" alone must return true
      const ctx = createPrimaryExpression('false')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given "null" identifier alone, Then should not create mutations', () => {
      // Arrange — kills lower==="true" || lower==="false" && lower==="null" mutation where "null" alone must return true
      const ctx = createPrimaryExpression('null')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given "true" identifier alone, Then should not create mutations', () => {
      // Arrange — kills lower==="false" || lower==="null" replacing the whole condition
      const ctx = createPrimaryExpression('true')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a numeric literal starting with digit, When entering the expression, Then should not create mutations', () => {
    it.each([
      '0',
      '1',
      '99',
      '3.14',
    ])('Then should not create mutations for numeric literal %s', numLiteral => {
      // Arrange — kills /^\\d/.test(text) → false BlockStatement mutant
      const ctx = createPrimaryExpression(numLiteral)

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given "this" keyword only, When super is not the text, Then mutations are still suppressed', () => {
    it('Given "this" alone, Then should not create mutations (kills this&&super mutation)', () => {
      // Arrange — kills text==='this' && text==='super' mutation: 'this' must independently suppress
      const ctx = createPrimaryExpression('this')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given "super" alone, Then should not create mutations (kills this&&super mutation)', () => {
      // Arrange — kills text==='this' && text==='super' mutation: 'super' must independently suppress
      const ctx = createPrimaryExpression('super')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a string literal starting with single quote, When entering the expression, Then should not create mutations', () => {
    it("Given a string literal 'x', Then should produce 0 mutations (the quote prefix is sufficient to suppress)", () => {
      // Arrange — kills text.startsWith("'") → text.startsWith("") StringLiteral mutant:
      // startsWith("") is always true for any string, so a plain identifier would also be blocked.
      // Pairing this test with the 4-mutations test for 'counter' ensures the check is specific to "'".
      const ctx = createPrimaryExpression("'x'")

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('Given a plain identifier not starting with a quote, Then should produce 4 mutations (confirms the quote check is specific)', () => {
      // Arrange — kills startsWith("'") → startsWith("") mutant: if startsWith("") were used,
      // even 'counter' would be blocked because every string starts with "".
      const ctx = createPrimaryExpression('counter')

      // Act
      sut.enterPrimaryExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(4)
    })
  })

  describe('Given a primary expression directly inside a ReturnStatement', () => {
    describe('When entering the expression', () => {
      it('Then should create only 2 mutations (++x and --x), skipping post-op x++ and x-- as they are equivalent', () => {
        // Arrange
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const ctx = createPrimaryExpression('counter')
        TestUtil.setParent(ctx, returnCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('++counter')
        expect(sut._mutations[1].replacement).toBe('--counter')
      })
    })
  })

  describe('Given a primary expression nested inside a ReturnStatement via intermediate context', () => {
    describe('When entering the expression', () => {
      it('Then should create only 2 mutations (++x and --x)', () => {
        // Arrange
        const returnCtx = Object.create(ReturnStatementContext.prototype)
        const intermediateCtx = {
          parent: returnCtx,
        } as unknown as ParserRuleContext
        const ctx = createPrimaryExpression('value')
        TestUtil.setParent(ctx, intermediateCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(2)
        expect(sut._mutations[0].replacement).toBe('++value')
        expect(sut._mutations[1].replacement).toBe('--value')
      })
    })
  })
})
