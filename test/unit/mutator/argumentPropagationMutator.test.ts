import { ParserRuleContext } from 'antlr4ts'
import { ArgumentPropagationMutator } from '../../../src/mutator/argumentPropagationMutator.js'
import { ApexMethod, ApexType } from '../../../src/type/ApexMethod.js'
import { TestUtil } from '../../utils/testUtil.js'

const createExpressionListContext = (args: ParserRuleContext[]) => {
  const commaInterleaved: unknown[] = []
  args.forEach((arg, i) => {
    commaInterleaved.push(arg)
    if (i < args.length - 1) {
      commaInterleaved.push({ text: ',' })
    }
  })

  const node = {
    children: commaInterleaved,
    childCount: commaInterleaved.length,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  Object.defineProperty(node, 'constructor', {
    value: { name: 'ExpressionListContext' },
  })
  return node
}

const createArgNode = (text: string) => {
  const node = {
    text,
    childCount: 0,
    children: [],
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  return node
}

const createMethodCallContext = (
  methodName: string,
  args: ParserRuleContext[]
) => {
  const expressionList =
    args.length > 0 ? createExpressionListContext(args) : null
  const children: unknown[] = [
    { text: methodName },
    { text: '(' },
    ...(expressionList ? [expressionList] : []),
    { text: ')' },
  ]

  const node = {
    children,
    childCount: children.length,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  return node
}

const createMethodCallExpression = (
  methodName: string,
  args: ParserRuleContext[]
) => {
  const methodCall = createMethodCallContext(methodName, args)

  return {
    childCount: 1,
    text: `${methodName}(${args.map(a => a.text).join(',')})`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 20),
    getChild: (index: number) => (index === 0 ? methodCall : null),
  } as unknown as ParserRuleContext
}

const createDotMethodCallContext = (
  methodName: string,
  args: ParserRuleContext[]
) => {
  const expressionList =
    args.length > 0 ? createExpressionListContext(args) : null
  const children: unknown[] = [
    { text: methodName },
    { text: '(' },
    ...(expressionList ? [expressionList] : []),
    { text: ')' },
  ]

  const node = {
    children,
    childCount: children.length,
  } as unknown as ParserRuleContext
  Object.setPrototypeOf(node, ParserRuleContext.prototype)
  Object.defineProperty(node, 'constructor', {
    value: { name: 'DotMethodCallContext' },
  })
  return node
}

const createDotExpression = (
  receiverText: string,
  methodName: string,
  args: ParserRuleContext[]
) => {
  const dotMethodCall = createDotMethodCallContext(methodName, args)

  return {
    children: [{ text: receiverText }, { text: '.' }, dotMethodCall],
    childCount: 3,
    text: `${receiverText}.${methodName}(${args.map(a => a.text).join(',')})`,
    start: TestUtil.createToken(1, 0),
    stop: TestUtil.createToken(1, 30),
  } as unknown as ParserRuleContext
}

describe('ArgumentPropagationMutator', () => {
  let sut: ArgumentPropagationMutator

  beforeEach(() => {
    sut = new ArgumentPropagationMutator()
  })

  describe('Given a method call with matching-type argument', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation replacing call with argument', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('process', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'String',
          'input'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const argNode = createArgNode('input')
        const ctx = createMethodCallExpression('process', [argNode])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('input')
        expect(sut._mutations[0].mutationName).toBe(
          'ArgumentPropagationMutator'
        )
      })
    })
  })

  describe('Given a method call with non-matching-type argument', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('process', {
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
          'count'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const argNode = createArgNode('count')
        const ctx = createMethodCallExpression('process', [argNode])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a method call with no arguments', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('process', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const ctx = createMethodCallExpression('process', [])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a method call with multiple args where some match', () => {
    describe('When entering the expression', () => {
      it('Then should create mutations only for matching args', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('compute', {
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varX = TestUtil.createLocalVariableDeclaration('Integer', 'x')
        sut.enterLocalVariableDeclaration(varX)

        const varY = TestUtil.createLocalVariableDeclaration('String', 'y')
        sut.enterLocalVariableDeclaration(varY)

        const argX = createArgNode('x')
        const argY = createArgNode('y')
        const ctx = createMethodCallExpression('compute', [argX, argY])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('x')
      })
    })
  })

  describe('Given a method call not in typeTable', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        sut.setTypeTable(new Map())
        const argNode = createArgNode('x')
        const ctx = createMethodCallExpression('unknownMethod', [argNode])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a dot expression method call with matching arg', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('transform', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
        sut.enterMethodDeclaration(methodCtx)

        const varDecl = TestUtil.createLocalVariableDeclaration(
          'String',
          'input'
        )
        sut.enterLocalVariableDeclaration(varDecl)

        const argNode = createArgNode('input')
        const ctx = createDotExpression('obj', 'transform', [argNode])

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('input')
      })
    })
  })

  describe('Given a dot expression that is a field access', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const lastChild = { text: 'fieldName' }
        const ctx = {
          children: [{ text: 'obj' }, { text: '.' }, lastChild],
          childCount: 3,
        } as unknown as ParserRuleContext

        // Act
        sut.enterDotExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given string literal argument matching String return type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('process', {
          returnType: 'String',
          startLine: 1,
          endLine: 5,
          type: ApexType.STRING,
        })
        sut.setTypeTable(typeTable)

        const argNode = createArgNode("'hello'")
        const ctx = createMethodCallExpression('process', [argNode])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe("'hello'")
      })
    })
  })

  describe('Given numeric literal argument matching Integer return type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('process', {
          returnType: 'Integer',
          startLine: 1,
          endLine: 5,
          type: ApexType.INTEGER,
        })
        sut.setTypeTable(typeTable)

        const argNode = createArgNode('42')
        const ctx = createMethodCallExpression('process', [argNode])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('42')
      })
    })
  })

  describe('Given boolean literal argument matching Boolean return type', () => {
    describe('When entering the expression', () => {
      it('Then should create mutation', () => {
        // Arrange
        const typeTable = new Map<string, ApexMethod>()
        typeTable.set('process', {
          returnType: 'Boolean',
          startLine: 1,
          endLine: 5,
          type: ApexType.BOOLEAN,
        })
        sut.setTypeTable(typeTable)

        const argNode = createArgNode('true')
        const ctx = createMethodCallExpression('process', [argNode])

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(1)
        expect(sut._mutations[0].replacement).toBe('true')
      })
    })
  })

  describe('Given a method call expression with childCount !== 1', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = { childCount: 2 } as unknown as ParserRuleContext

        // Act
        sut.enterMethodCallExpression(ctx)

        // Assert
        expect(sut._mutations).toHaveLength(0)
      })
    })
  })

  describe('Given a method call expression where child is not ParserRuleContext', () => {
    describe('When entering the expression', () => {
      it('Then should not create any mutations', () => {
        // Arrange
        const ctx = {
          childCount: 1,
          getChild: () => ({ text: 'notAContext' }),
        } as unknown as ParserRuleContext

        // Act
        sut.enterMethodCallExpression(ctx)

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
          children: [{ text: 'obj' }],
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

  describe('Given scope isolation for variable tracking', () => {
    it('Then variable in method A should not affect method B', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)

      const methodACtx = TestUtil.createMethodDeclaration('void', 'methodA')
      sut.enterMethodDeclaration(methodACtx)

      const varDecl = TestUtil.createLocalVariableDeclaration('String', 'input')
      sut.enterLocalVariableDeclaration(varDecl)

      sut.exitMethodDeclaration()

      const methodBCtx = TestUtil.createMethodDeclaration('void', 'methodB')
      sut.enterMethodDeclaration(methodBCtx)

      const argNode = createArgNode('input')
      const ctx = createMethodCallExpression('process', [argNode])

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given formal parameter type tracking', () => {
    it('Then should match argument type from formal parameter', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const methodCtx = TestUtil.createMethodDeclaration('void', 'testMethod')
      sut.enterMethodDeclaration(methodCtx)

      const paramCtx = TestUtil.createFormalParameter('Integer', 'value')
      sut.enterFormalParameter(paramCtx)

      const argNode = createArgNode('value')
      const ctx = createMethodCallExpression('process', [argNode])

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('value')
    })
  })

  describe('Given enhanced for control type tracking', () => {
    it('Then should match argument type from loop variable', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('process', {
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

      const argNode = createArgNode('item')
      const ctx = createMethodCallExpression('process', [argNode])

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('item')
    })
  })

  describe('Given a dot expression with method not in typeTable', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      sut.setTypeTable(new Map())
      const argNode = createArgNode('x')
      const ctx = createDotExpression('obj', 'unknownMethod', [argNode])

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression with DotMethodCallContext with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const dotMethodCall = {
        children: [{ text: 'method' }],
        childCount: 1,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(dotMethodCall, ParserRuleContext.prototype)
      Object.defineProperty(dotMethodCall, 'constructor', {
        value: { name: 'DotMethodCallContext' },
      })

      const ctx = {
        children: [{ text: 'obj' }, { text: '.' }, dotMethodCall],
        childCount: 3,
      } as unknown as ParserRuleContext

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a dot expression method call with no matching args', () => {
    it('Then should not create any mutations when all args are empty', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('transform', {
        returnType: 'String',
        startLine: 1,
        endLine: 5,
        type: ApexType.STRING,
      })
      sut.setTypeTable(typeTable)

      const ctx = createDotExpression('obj', 'transform', [])

      // Act
      sut.enterDotExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given a method call child with insufficient children', () => {
    it('Then should not create any mutations', () => {
      // Arrange
      const methodCall = {
        children: [{ text: 'process' }],
        childCount: 1,
      } as unknown as ParserRuleContext
      Object.setPrototypeOf(methodCall, ParserRuleContext.prototype)

      const ctx = {
        childCount: 1,
        getChild: () => methodCall,
      } as unknown as ParserRuleContext

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(0)
    })
  })

  describe('Given method call argument resolved as method return type', () => {
    it('Then should match argument type from method call', () => {
      // Arrange
      const typeTable = new Map<string, ApexMethod>()
      typeTable.set('outer', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      typeTable.set('inner', {
        returnType: 'Integer',
        startLine: 1,
        endLine: 5,
        type: ApexType.INTEGER,
      })
      sut.setTypeTable(typeTable)

      const argNode = createArgNode('inner()')
      const ctx = createMethodCallExpression('outer', [argNode])

      // Act
      sut.enterMethodCallExpression(ctx)

      // Assert
      expect(sut._mutations).toHaveLength(1)
      expect(sut._mutations[0].replacement).toBe('inner()')
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
