import { ParserRuleContext } from 'antlr4ts'
import { EmptyCollectionReturnMutator } from '../../../src/mutator/emptyCollectionReturnMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

describe('EmptyCollectionReturnMutator', () => {
  let sut: EmptyCollectionReturnMutator

  beforeEach(() => {
    sut = new EmptyCollectionReturnMutator()
  })

  describe('Given a return statement in a method returning List', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return empty List', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'List<Account>',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'List<Account>',
          startLine: 1,
          endLine: 10,
          type: ApexType.LIST,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('accounts')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new List<Account>()')
        expect(sut._mutations[0].mutationName).toBe(
          'EmptyCollectionReturnMutator'
        )
      })
    })
  })

  describe('Given a return statement in a method returning Set', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return empty Set', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Set<Id>',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Set<Id>',
          startLine: 1,
          endLine: 10,
          type: ApexType.SET,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('idSet')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new Set<Id>()')
      })
    })
  })

  describe('Given a return statement in a method returning Map', () => {
    describe('When entering the return statement', () => {
      it('Then should create mutation to return empty Map', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Map<Id,Account>',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Map<Id,Account>',
          startLine: 1,
          endLine: 10,
          type: ApexType.MAP,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('accountMap')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('new Map<Id,Account>()')
      })
    })
  })

  describe('Given a return statement already returning empty collection', () => {
    describe('When returning new List<T>()', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'List<String>',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'List<String>',
          startLine: 1,
          endLine: 10,
          type: ApexType.LIST,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('new List<String>()')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning new Set<T>()', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Set<Id>',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Set<Id>',
          startLine: 1,
          endLine: 10,
          type: ApexType.SET,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('new Set<Id>()')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning new Map<K,V>()', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Map<Id,Account>',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Map<Id,Account>',
          startLine: 1,
          endLine: 10,
          type: ApexType.MAP,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement(
          'new Map<Id,Account>()'
        )
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a return statement in a method returning non-collection type', () => {
    describe('When returning String', () => {
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

    describe('When returning Integer', () => {
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

        const returnCtx = TestUtil.createReturnStatement('42')
        sut._mutations = []

        // Act
        sut.enterReturnStatement(returnCtx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })

    describe('When returning Object', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const methodCtx = TestUtil.createMethodDeclaration(
          'Account',
          'testMethod'
        )
        sut.enterMethodDeclaration(methodCtx)

        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('testMethod', {
          returnType: 'Account',
          startLine: 1,
          endLine: 10,
          type: ApexType.OBJECT,
        })
        sut.setTypeTable(typeTable)

        const returnCtx = TestUtil.createReturnStatement('acc')
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
        const returnCtx = TestUtil.createReturnStatement('accounts')
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
        'List<String>',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'List<String>',
        startLine: 1,
        endLine: 10,
        type: ApexType.LIST,
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
        'List<String>',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'List<String>',
        startLine: 1,
        endLine: 10,
        type: ApexType.LIST,
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
        'List<String>',
        'testMethod'
      )
      sut.enterMethodDeclaration(methodCtx)

      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('testMethod', {
        returnType: 'List<String>',
        startLine: 1,
        endLine: 10,
        type: ApexType.LIST,
      })
      sut.setTypeTable(typeTable)

      const returnCtx = {
        children: [
          { text: 'return' },
          { text: 'myList' }, // Not a ParserRuleContext
        ],
        childCount: 2,
        getChild: (i: number) =>
          i === 0 ? { text: 'return' } : { text: 'myList' },
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
        returnType: 'List<String>',
        startLine: 1,
        endLine: 10,
        type: ApexType.LIST,
      })
      sut.setTypeTable(typeTable)

      const returnCtx = TestUtil.createReturnStatement('myList')
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
        'List<String>',
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
