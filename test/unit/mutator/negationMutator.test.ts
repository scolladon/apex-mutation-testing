import { ParserRuleContext } from 'antlr4ts'
import { NegationMutator } from '../../../src/mutator/negationMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('NegationMutator', () => {
  let sut: NegationMutator

  beforeEach(() => {
    sut = new NegationMutator()
  })

  describe('Given a method returning Integer', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning a simple variable', () => {
      it('Then should create mutation to negate the value', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('x')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-x')
        expect(sut._mutations[0].mutationName).toBe('NegationMutator')
      })
    })

    describe('When returning a numeric literal', () => {
      it('Then should create mutation to negate the value', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('42')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-42')
      })
    })
  })

  describe('Given a method returning String', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration('String', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning a value', () => {
      it('Then should NOT create mutation (non-numeric type)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('name')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a method returning Boolean', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Boolean',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Boolean',
        startLine: 1,
        endLine: 5,
        type: ApexType.BOOLEAN,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning a value', () => {
      it('Then should NOT create mutation (non-numeric type)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('isActive')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a method returning List', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'List<String>',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'List<String>',
        startLine: 1,
        endLine: 5,
        type: ApexType.LIST,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning a value', () => {
      it('Then should NOT create mutation (non-numeric type)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('items')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given numeric type mutations', () => {
    const numericTypes = [
      { type: ApexType.INTEGER, typeName: 'Integer' },
      { type: ApexType.LONG, typeName: 'Long' },
      { type: ApexType.DOUBLE, typeName: 'Double' },
      { type: ApexType.DECIMAL, typeName: 'Decimal' },
    ]

    for (const { type, typeName } of numericTypes) {
      it(`Then should create mutation for ${typeName} return type`, () => {
        // Arrange
        sut._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          typeName,
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: typeName,
          startLine: 1,
          endLine: 5,
          type,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('value')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-value')
      })
    }
  })

  describe('Given non-numeric type mutations', () => {
    const nonNumericTypes = [
      { type: ApexType.STRING, typeName: 'String' },
      { type: ApexType.BOOLEAN, typeName: 'Boolean' },
      { type: ApexType.DATE, typeName: 'Date' },
      { type: ApexType.DATETIME, typeName: 'DateTime' },
      { type: ApexType.ID, typeName: 'Id' },
      { type: ApexType.LIST, typeName: 'List<String>' },
      { type: ApexType.MAP, typeName: 'Map<Id, Account>' },
      { type: ApexType.SET, typeName: 'Set<String>' },
      { type: ApexType.OBJECT, typeName: 'Account' },
      { type: ApexType.VOID, typeName: 'void' },
    ]

    for (const { type, typeName } of nonNumericTypes) {
      it(`Then should NOT create mutation for ${typeName} return type`, () => {
        // Arrange
        sut._mutations = []
        const methodCtx = TestUtil.createMethodDeclaration(
          typeName,
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: typeName,
          startLine: 1,
          endLine: 5,
          type,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('value')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    }
  })

  describe('Given already negated expressions (double negation prevention)', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning a PreOpExpression with unary minus', () => {
      it('Then should NOT create mutation (avoid double negation)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatementWithPreOp('-', 'x')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning a PreOpExpression with unary minus on literal', () => {
      it('Then should NOT create mutation (avoid double negation)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatementWithPreOp('-', '42')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning a PreOpExpression with other operator (++)', () => {
      it('Then should create mutation (not a negation)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatementWithPreOp('++', 'x')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
      })
    })
  })

  describe('Given complex expressions (smart wrapping)', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning a complex expression (a + b)', () => {
      it('Then should wrap in parentheses: -(a + b)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatementWithComplexExpression(
          'a + b',
          3
        )

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-(a + b)')
      })
    })

    describe('When returning a simple variable', () => {
      it('Then should NOT wrap in parentheses: -x', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('x')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-x')
      })
    })

    describe('When returning a simple literal', () => {
      it('Then should NOT wrap in parentheses: -42', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('42')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-42')
      })
    })
  })

  describe('Given zero literal expressions (equivalent mutant prevention)', () => {
    beforeEach(() => {
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)
    })

    describe('When returning integer zero literal', () => {
      it('Then should NOT create mutation (-0 is equivalent to 0)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('0')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning double zero literal', () => {
      it('Then should NOT create mutation (-0.0 is equivalent to 0.0)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('0.0')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning long zero literal', () => {
      it('Then should NOT create mutation (-0L is equivalent to 0L)', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('0L')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning non-zero literal', () => {
      it('Then should create mutation', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('10')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('-10')
      })
    })
  })

  describe('Given edge cases', () => {
    describe('When no type table is set', () => {
      it('Then should NOT create mutation', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Integer',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)
        const returnCtx = TestUtil.createReturnStatement('x')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When not inside a method', () => {
      it('Then should NOT create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('x')

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When return statement has no expression', () => {
      it('Then should NOT create mutation', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Integer',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = {
          children: [{ text: 'return' }],
          childCount: 1,
        } as unknown as ParserRuleContext

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })
})
