import { ParserRuleContext } from 'antlr4ts'
import { ZeroReturnMutator } from '../../../src/mutator/zeroReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('ZeroReturnMutator', () => {
  let sut: ZeroReturnMutator

  beforeEach(() => {
    sut = new ZeroReturnMutator()
  })

  describe('Given a return statement in a method returning Integer', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return 0', () => {
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
          endLine: 10,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('result')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
        expect(sut._mutations[0].mutationName).toBe('ZeroReturnMutator')
      })
    })
  })

  describe('Given a return statement in a method returning Double', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return 0', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Double',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Double',
          startLine: 1,
          endLine: 10,
          type: ApexType.DOUBLE,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('3.14')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })

  describe('Given a return statement in a method returning Decimal', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return 0', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Decimal',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Decimal',
          startLine: 1,
          endLine: 10,
          type: ApexType.DECIMAL,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('amount')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })

  describe('Given a return statement in a method returning Long', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return 0', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration('Long', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Long',
          startLine: 1,
          endLine: 10,
          type: ApexType.LONG,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('bigNumber')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('0')
      })
    })
  })

  describe('Given a return statement already returning 0', () => {
    describe('When entering the return statement', () => {
      it('Then should not create any mutations', () => {
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
          endLine: 10,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('0')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a return statement in a method returning String', () => {
    describe('When entering the return statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'String',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'String',
          startLine: 1,
          endLine: 10,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement("'hello'")
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a return statement without type information', () => {
    describe('When entering the return statement', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const returnCtx = TestUtil.createReturnStatement('result')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('validation and edge cases', () => {
    it('should handle return statement with no children', () => {
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
        endLine: 10,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const returnCtx = {
        children: null,
        childCount: 0,
      } as unknown as ParserRuleContext

      sut._mutations = []

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('should handle return statement with insufficient children', () => {
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
        endLine: 10,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const returnCtx = {
        children: [{ text: 'return' }],
        childCount: 1,
      } as unknown as ParserRuleContext

      sut._mutations = []

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('should handle non-ParserRuleContext expression node', () => {
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
        endLine: 10,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          { text: '42' }, // Not a ParserRuleContext
        ],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: '42' },
      } as unknown as ParserRuleContext

      sut._mutations = []

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })

    it('should handle missing method context', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 10,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const returnCtx = TestUtil.createReturnStatement('42')
      sut._mutations = []

      // Act
      sut.enterReturnStatement(returnCtx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('method tracking', () => {
    it('should set currentMethodName on enter', () => {
      // Arrange
      const methodCtx = TestUtil.createMethodDeclaration(
        'Integer',
        'testMethod'
      )

      // Act
      sut.enterMethodDeclaration(methodCtx)

      // Assert
      expect(sut['currentMethodName']).toBe('testMethod')
    })

    it('should clear currentMethodName on exit', () => {
      // Arrange
      sut['currentMethodName'] = 'testMethod'

      // Act
      sut.exitMethodDeclaration()

      // Assert
      expect(sut['currentMethodName']).toBeNull()
    })
  })
})
