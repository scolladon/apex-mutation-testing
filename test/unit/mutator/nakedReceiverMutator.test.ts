import { ParserRuleContext } from 'antlr4ts'
import { NakedReceiverMutator } from '../../../src/mutator/nakedReceiverMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

const createDotMethodCallContext = (methodName: string) => {
  const node = {
    children: [{ text: methodName }, { text: '(' }, { text: ')' }],
    childCount: 3,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  Object.defineProperty(node, 'constructor', {
    value: { name: 'DotMethodCallContext' },
  })
  return node
}

const createDotExpression = (receiverText: string, methodName: string) => {
  const dotMethodCall = createDotMethodCallContext(methodName)

  return {
    children: [{ text: receiverText }, { text: '.' }, dotMethodCall],
    childCount: 3,
    text: `${receiverText}.${methodName}()`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 20),
  } as unknown as ParserRuleContext
}

describe('NakedReceiverMutator', () => {
  let sut: NakedReceiverMutator

  beforeEach(() => {
    sut = new NakedReceiverMutator()
  })

  describe('Given a dot expression where receiver type matches method return type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation replacing expression with receiver', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('clone', {
          returnType: 'Account',
          startLine: 1,
          endLine: 5,
          type: ApexType.OBJECT,
        })
        sut.setTypeTable(typeTable)

        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Account',
          'account'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const ctx = createDotExpression('account', 'clone')

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('account')
        expect(sut._mutations[0].mutationName).toBe('NakedReceiverMutator')
      })
    })
  })

  describe('Given a dot expression where types do not match', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('toString', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'Integer',
          'num'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const ctx = createDotExpression('num', 'toString')

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dot expression that is a field access (not method call)', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const lastChild = { text: 'Name' }
        const ctx = {
          children: [{ text: 'account' }, { text: '.' }, lastChild],
          childCount: 3,
        } as unknown as ParserRuleContext

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dot expression with method not in typeTable', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        sut.setTypeTable(new Map())
        const ctx = createDotExpression('account', 'unknownMethod')

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dot expression with insufficient children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          children: [{ text: 'account' }],
          childCount: 1,
        } as unknown as ParserRuleContext

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dot expression with null children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = { children: null } as unknown as ParserRuleContext

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dot expression with non-ParserRuleContext last child', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          children: [{ text: 'account' }, { text: '.' }, { text: 'field' }],
          childCount: 3,
        } as unknown as ParserRuleContext

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dotMethodCall with insufficient children', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('clone', {
          returnType: 'Account',
          startLine: 1,
          endLine: 5,
          type: ApexType.OBJECT,
        })
        sut.setTypeTable(typeTable)

        const dotMethodCall = {
          children: [{ text: 'clone' }],
          childCount: 1,
        } as unknown as ParserRuleContext
        Object.setPrototypeOf(dotMethodCall, ParserRuleContext.prototype)
        Object.defineProperty(dotMethodCall, 'constructor', {
          value: { name: 'DotMethodCallContext' },
        })

        const ctx = {
          children: [{ text: 'account' }, { text: '.' }, dotMethodCall],
          childCount: 3,
        } as unknown as ParserRuleContext

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given class field variable with matching type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('deepClone', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const fieldDecl = TestUtil.createFieldDeclaration('String', 'builder')
        sut.enterFieldDeclaration(fieldDecl)

        const ctx = createDotExpression('builder', 'deepClone')

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('builder')
      })
    })
  })

  describe('Given formal parameter with matching type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('copy', {
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const paramCtx = TestUtil.createFormalParameter('Integer', 'num')
        sut.enterFormalParameter(paramCtx)

        const ctx = createDotExpression('num', 'copy')

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('num')
      })
    })
  })

  describe('Given scope isolation between methods', () => {
    it('Then variable in method A should not affect method B', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('clone', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)

      const methodACtx = TestUtil.createMethodDeclaration('void', 'methodA')
      sut.enterMethodDeclaration(methodACtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('String', 'data')
      sut.enterLocalVariableDeclaration(varDecl)

      sut.exitMethodDeclaration()

      const methodBCtx = TestUtil.createMethodDeclaration('void', 'methodB')
      sut.enterMethodDeclaration(methodBCtx)

      const ctx = createDotExpression('data', 'clone')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given enhanced for control variable with matching type', () => {
    it('Then should create mutation', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('copy', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)

      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const forCtx = TestUtil.createEnhancedForControl('String', 'item')
      sut.enterEnhancedForControl(forCtx)

      const ctx = createDotExpression('item', 'copy')

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('item')
    })
  })

  describe('Given receiver with unknown type', () => {
    describe('When method returns OBJECT type', () => {
      it('Then should create mutation since both resolve to OBJECT', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('transform', {
          returnType: 'CustomClass',
          startLine: 1,
          endLine: 5,
          type: ApexType.OBJECT,
        })
        sut.setTypeTable(typeTable)

        const ctx = createDotExpression('unknownVar', 'transform')

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('unknownVar')
      })
    })
  })

  describe('Given edge cases for type tracking', () => {
    it('Then should handle enterFormalParameter with no children gracefully', () => {
      const ctx = { children: null } as unknown as ParserRuleContext
      expect(() => sut.enterFormalParameter(ctx)).not.toThrow()
    })

    it('Then should handle enterEnhancedForControl with no children gracefully', () => {
      const ctx = { children: null } as unknown as ParserRuleContext
      expect(() => sut.enterEnhancedForControl(ctx)).not.toThrow()
    })

    it('Then should handle enterLocalVariableDeclaration with no children gracefully', () => {
      const ctx = { children: null } as unknown as ParserRuleContext
      expect(() => sut.enterLocalVariableDeclaration(ctx)).not.toThrow()
    })

    it('Then should handle enterFieldDeclaration with no children gracefully', () => {
      const ctx = { children: null } as unknown as ParserRuleContext
      expect(() => sut.enterFieldDeclaration(ctx)).not.toThrow()
    })
  })
})
