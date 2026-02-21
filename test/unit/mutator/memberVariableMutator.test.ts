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
    sut.setCoveredLines(new Set([1]))
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

  describe('Given a field declaration on uncovered line', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const declarator = createVariableDeclarator('count', true, '5')
        const declarators = createVariableDeclarators([declarator])
        const ctx = {
          children: [{ text: 'Integer' }, declarators, { text: ';' }],
          childCount: 3,
          start: TestUtil.createToken(99, 0),
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
})
