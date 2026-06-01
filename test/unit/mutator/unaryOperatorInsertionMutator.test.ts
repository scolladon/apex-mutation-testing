import { ParserRuleContext } from 'antlr4ts'
import {
  DotExpressionContext,
  IdPrimaryContext,
  LiteralPrimaryContext,
  MethodDeclarationContext,
  ReturnStatementContext,
} from 'apex-parser'
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
  options?: { withTokens?: boolean; primaryProto?: object }
) => {
  const { withTokens = true, primaryProto = IdPrimaryContext.prototype } =
    options ?? {}

  const primary = Object.create(primaryProto)
  Object.defineProperty(primary, 'text', {
    get: () => text,
    configurable: true,
  })
  primary.children = []

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

  describe('Given a primary expression whose child is not an IdPrimaryContext', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (allowlist rejects all non-Id primaries: literal, this, super, soql, sosl, type-ref, void)', () => {
        // Arrange
        const ctx = createPrimaryExpression('42', {
          primaryProto: LiteralPrimaryContext.prototype,
        })

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

  describe('Given a primary expression that is the receiver of a DotExpression', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (receiver of `.` or `?.` is not assignable)', () => {
        // Arrange
        const dotCtx = Object.create(DotExpressionContext.prototype)
        const ctx = createPrimaryExpression('String')
        TestUtil.setParent(ctx, dotCtx)

        // Act
        sut.enterPrimaryExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
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
