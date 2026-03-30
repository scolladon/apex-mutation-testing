import { ParserRuleContext } from 'antlr4ts'
import { MemberVariableMutator } from '../../../src/mutator/memberVariableMutator.js'
import { TestUtil } from '../../utils/testUtil.js'

const createVariableDeclarator = (
  varName: string,
  hasInitializer: boolean,
  initValue?: string
) => {
  const children = hasInitializer
    ? [{ text: varName }, { text: '=' }, { text: initValue ?? '5' }]
    : [{ text: varName }]

  const node = {
    children,
    childCount: children.length,
    text: hasInitializer ? `${varName}=${initValue ?? '5'}` : varName,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 10),
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  return node
}

const createVariableDeclarators = (declarators: ParserRuleContext[]) => {
  const node = {
    children: declarators,
    childCount: declarators.length,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  return node
}

const createFieldDeclaration = (
  typeName: string,
  declarators: ParserRuleContext
) => {
  return {
    children: [{ text: typeName }, declarators, { text: ';' }],
    childCount: 3,
    start: TestUtil.createToken(1, 0),
  } as unknown as ParserRuleContext
}

describe('MemberVariableMutator', () => {
  let sut: MemberVariableMutator

  beforeEach(() => {
    sut = new MemberVariableMutator()
  })

  describe('Given a field declaration with initializer (Integer count = 5)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation replacing declarator with just variable name', () => {
        // Arrange
        const declarator = createVariableDeclarator('count', true, '5')
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('count')
        expect(sut._mutations[0].mutationName).toBe('MemberVariableMutator')
      })
    })
  })

  describe('Given a field declaration with boolean initializer (Boolean isActive = true)', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const declarator = createVariableDeclarator('isActive', true, 'true')
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('Boolean', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('isActive')
      })
    })
  })

  describe('Given a field declaration with string initializer', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const declarator = createVariableDeclarator('name', true, "'default'")
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('String', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('name')
      })
    })
  })

  describe('Given a field declaration without initializer (Integer count)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const declarator = createVariableDeclarator('count', false)
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a field declaration with null children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          children: null,
          start: TestUtil.createToken(1, 0),
        } as unknown as ParserRuleContext

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a field declaration with no ParserRuleContext children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          children: [{ text: 'Integer' }, { text: ';' }],
          childCount: 2,
          start: TestUtil.createToken(1, 0),
        } as unknown as ParserRuleContext

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a variable declarators node with null children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const declarators = {
          children: null,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a variable declarator with fewer than 3 children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const declarator = createVariableDeclarator('count', false)
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a variable declarators node with non-ParserRuleContext declarator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const nonPrcDeclarator = { text: 'count = 5' }
        const declarators = {
          children: [nonPrcDeclarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a variable declarator with 3+ children but no assignment operator', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const declarator = {
          children: [{ text: 'count' }, { text: ':' }, { text: 'Integer' }],
          childCount: 3,
          text: 'count:Integer',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 10),
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a field declaration with null initializer (String name = null)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations as removing null initializer is always equivalent', () => {
        // Arrange
        const declarator = createVariableDeclarator('name', true, 'null')
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('String', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a field declaration with uppercase NULL initializer (String name = NULL)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (case-insensitive null check)', () => {
        // Arrange — tests that toLowerCase() is used so 'NULL' is also skipped
        const declarator = createVariableDeclarator('name', true, 'NULL')
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('String', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a field declaration child that is not a ParserRuleContext but contains PRC declarators', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills !(child instanceof ParserRuleContext) → false mutant)', () => {
        // Arrange
        // With mutant `false`: condition never skips, so a non-PRC child that contains
        // PRC declarators with start/stop would be processed and create a mutation.
        // Original code skips non-PRC children entirely.
        const validDeclarator = createVariableDeclarator('count', true, '5')
        const nonPrcDeclaratorsChild = {
          children: [validDeclarator],
          childCount: 1,
          // NOT setPrototypeOf to PRC — this is NOT a ParserRuleContext
        } as unknown as ParserRuleContext

        const ctx = {
          children: [
            { text: 'Integer' },
            nonPrcDeclaratorsChild,
            { text: ';' },
          ],
          childCount: 3,
          start: TestUtil.createToken(1, 0),
        } as unknown as ParserRuleContext

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a variable declarators node containing a non-ParserRuleContext child that has children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills !(declarator instanceof ParserRuleContext) → false mutant)', () => {
        // Arrange
        // With mutant `false`: non-PRC declarators with children/start/stop would be processed
        // and create a mutation. Original code skips them via the instanceof guard.
        const nonPrcDeclarator = {
          text: 'count=5',
          children: [{ text: 'count' }, { text: '=' }, { text: '5' }],
          childCount: 3,
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 10),
        } as unknown as ParserRuleContext

        const declarators = {
          children: [nonPrcDeclarator],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarators, ParserRuleContext.prototype)

        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a variable declarator with exactly 2 children (missing initializer value)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations (kills declarator.children.length < 3 → < 2 mutant)', () => {
        // Arrange
        // With mutant `< 2`: length=2 → 2 < 2 → false → continues processing.
        // Original `< 3`: length=2 → 2 < 3 → true → returns early (correct).
        const declarator = {
          children: [{ text: 'count' }, { text: '=' }],
          childCount: 2,
          text: 'count=',
          start: TestUtil.createToken(1, 0),
          stop: TestUtil.createToken(1, 6),
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(declarator, ParserRuleContext.prototype)
        const declarators = createVariableDeclarators([declarator])
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a field declaration with multiple declarators only one of which is valid', () => {
    describe('When entering the expression', () => {
      it('Then should create exactly one mutation for the valid declarator', () => {
        // Arrange
        // Exercises the loop in processVariableDeclarators with mixed declarators,
        // killing any ConditionalExpression that skips all declarators.
        const validDeclarator = createVariableDeclarator('count', true, '5')
        const invalidDeclarator = createVariableDeclarator('other', false)
        const declarators = createVariableDeclarators([
          validDeclarator,
          invalidDeclarator,
        ])
        const ctx = createFieldDeclaration('Integer', declarators)

        // Act
        sut.enterFieldDeclaration(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('count')
      })
    })
  })
})
