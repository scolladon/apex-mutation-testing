import { TypeDiscoverer } from '../../../src/service/typeDiscoverer.js'
import { TypeMatcher } from '../../../src/service/typeMatcher.js'
import { APEX_TYPE } from '../../../src/type/ApexMethod.js'

describe('TypeDiscoverer', () => {
  describe('method return types', () => {
    it('Given class with method, When analyze, Then registry resolves method return type', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer calculate() {
            return 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('calculate')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.INTEGER,
          typeName: 'Integer',
        })
      )
    })

    it('Given class with List return type, When analyze, Then registry resolves with elementType', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public List<String> getNames() {
            return null;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('getNames')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.LIST,
          typeName: 'List<String>',
          elementType: 'String',
        })
      )
    })

    it('Given class with Map return type, When analyze, Then registry resolves with elementType', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Map<String,Integer> getMapping() {
            return null;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('getMapping')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.MAP,
          typeName: 'Map<String,Integer>',
          elementType: 'String,Integer',
        })
      )
    })

    it('Given class with array return type, When analyze, Then registry resolves as LIST with elementType', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public String[] getItems() {
            return null;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('getItems')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.LIST,
          typeName: 'String[]',
          elementType: 'String',
        })
      )
    })

    it('Given class with unknown return type and no matching matcher, When analyze, Then classifies as VOID', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public UnknownType getData() {
            return null;
          }
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('getData')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.VOID,
          typeName: 'UnknownType',
        })
      )
    })

    it('Given unknown method, When resolveType, Then returns null', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void doWork() {}
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      expect(registry.resolveType('nonExistent')).toBeNull()
    })
  })

  describe('variable scopes', () => {
    it('Given local variable, When analyze, Then registry resolves variable type scoped to method', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer calculate() {
            String name = 'test';
            return 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('calculate', 'name')
      expect(result).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })
    })

    it('Given formal parameter, When analyze, Then registry resolves parameter type scoped to method', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Integer calculate(Decimal rate) {
            return 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('calculate', 'rate')
      expect(result).toEqual({
        apexType: APEX_TYPE.DECIMAL,
        typeName: 'decimal',
      })
    })

    it('Given enhanced-for variable, When analyze, Then registry resolves variable type scoped to method', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void process() {
            List<Account> accs = new List<Account>();
            for (Account a : accs) {
              System.debug(a);
            }
          }
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('process', 'a')
      expect(result).toEqual({
        apexType: APEX_TYPE.VOID,
        typeName: 'account',
      })
    })

    it('Given variables in different methods, When analyze, Then scopes are isolated', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void methodA() {
            String x = 'hello';
          }
          public void methodB() {
            Integer x = 42;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const resultA = registry.resolveType('methodA', 'x')
      expect(resultA).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })

      const resultB = registry.resolveType('methodB', 'x')
      expect(resultB).toEqual({
        apexType: APEX_TYPE.INTEGER,
        typeName: 'integer',
      })
    })
  })

  describe('class fields', () => {
    it('Given class field, When analyze, Then registry resolves field type from any method', async () => {
      // Arrange
      const code = `
        public class TestClass {
          String label;
          public Integer calculate() {
            return 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('calculate', 'label')
      expect(result).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })
    })

    it('Given class field and local variable with same name, When analyze, Then local variable takes precedence', async () => {
      // Arrange
      const code = `
        public class TestClass {
          String value;
          public void doWork() {
            Integer value = 42;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('doWork', 'value')
      expect(result).toEqual({
        apexType: APEX_TYPE.INTEGER,
        typeName: 'integer',
      })
    })
  })

  describe('matcher integration', () => {
    it('Given matchers, When analyze, Then collect is called for each type declaration', async () => {
      // Arrange
      const code = `
        public class TestClass {
          String label;
          public Integer calculate(Decimal rate) {
            String name = 'test';
            return 0;
          }
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      await sut.analyze(code)

      // Assert
      expect(matcher.collect).toHaveBeenCalledWith('String')
      expect(matcher.collect).toHaveBeenCalledWith('Decimal')
    })

    it('Given matcher with populate, When analyze, Then populate is called after walk', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void doWork() {}
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
        populate: jest.fn().mockResolvedValue(undefined),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      await sut.analyze(code)

      // Assert
      expect(matcher.populate).toHaveBeenCalled()
    })

    it('Given matcher without populate, When analyze, Then no error is thrown', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void doWork() {}
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act & Assert
      await expect(sut.analyze(code)).resolves.not.toThrow()
    })

    it('Given multiple matchers, When analyze, Then all receive collect and populate calls', async () => {
      // Arrange
      const code = `
        public class TestClass {
          String label;
          public void doWork() {}
        }
      `
      const matcher1: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
        populate: jest.fn().mockResolvedValue(undefined),
      }
      const matcher2: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
        populate: jest.fn().mockResolvedValue(undefined),
      }
      const sut = new TypeDiscoverer()
        .withMatcher(matcher1)
        .withMatcher(matcher2)

      // Act
      await sut.analyze(code)

      // Assert
      expect(matcher1.collect).toHaveBeenCalledWith('String')
      expect(matcher2.collect).toHaveBeenCalledWith('String')
      expect(matcher1.populate).toHaveBeenCalled()
      expect(matcher2.populate).toHaveBeenCalled()
    })

    it('Given matcher that matches a type, When classifying return type, Then classifies as OBJECT', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Account getAccount() {
            return null;
          }
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockImplementation((t: string) => t === 'Account'),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('getAccount')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.OBJECT,
          typeName: 'Account',
        })
      )
    })
  })

  describe('withMatcher fluent API', () => {
    it('Given withMatcher call, When chaining, Then returns same instance', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: jest.fn(),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer()

      // Act
      const result = sut.withMatcher(matcher)

      // Assert
      expect(result).toBe(sut)
    })
  })

  describe('end-to-end integration', () => {
    it('Given class with fields, parameters, and local variables, When analyze, Then registry resolves all types correctly', async () => {
      // Arrange
      const code = `
        public class TestClass {
          String label;
          public Integer calculate(Decimal rate) {
            String name = 'test';
            return 0;
          }
        }
      `
      const matcher: TypeMatcher = {
        matches: jest.fn().mockReturnValue(false),
        collect: jest.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      const registry = await sut.analyze(code)

      // Assert
      expect(registry.resolveType('calculate')).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.INTEGER,
          typeName: 'Integer',
        })
      )

      expect(registry.resolveType('calculate', 'name')).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })

      expect(registry.resolveType('calculate', 'rate')).toEqual({
        apexType: APEX_TYPE.DECIMAL,
        typeName: 'decimal',
      })

      expect(registry.resolveType('calculate', 'label')).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })
    })
  })
})
