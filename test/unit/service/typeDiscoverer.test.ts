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
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
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
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
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

    it('Given catch clause variable, When analyze, Then registry resolves catch parameter type scoped to method', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void process() {
            try {
              doSomething();
            } catch (Exception e) {
              System.debug(e);
            }
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('process', 'e')
      expect(result).toEqual({
        apexType: APEX_TYPE.VOID,
        typeName: 'exception',
      })
    })

    it('Given catch clause with specific exception type, When analyze, Then registry resolves the specific type', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void process() {
            try {
              doSomething();
            } catch (DmlException ex) {
              System.debug(ex);
            }
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('process', 'ex')
      expect(result).toEqual({
        apexType: APEX_TYPE.VOID,
        typeName: 'dmlexception',
      })
    })

    it('Given multiple catch clauses, When analyze, Then registry resolves all catch parameter types', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void process() {
            try {
              doSomething();
            } catch (DmlException dmlEx) {
              System.debug(dmlEx);
            } catch (Exception e) {
              System.debug(e);
            }
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      expect(registry.resolveType('process', 'dmlEx')).toEqual({
        apexType: APEX_TYPE.VOID,
        typeName: 'dmlexception',
      })
      expect(registry.resolveType('process', 'e')).toEqual({
        apexType: APEX_TYPE.VOID,
        typeName: 'exception',
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
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      await sut.analyze(code)

      // Assert
      expect(matcher.collect).toHaveBeenCalledWith('String')
      expect(matcher.collect).toHaveBeenCalledWith('Decimal')
    })

    it('Given catch clause, When analyze, Then collect is called with the exception type', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void process() {
            try {
              doSomething();
            } catch (DmlException e) {
              System.debug(e);
            }
          }
        }
      `
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
        collectedTypes: new Set(),
      }
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      await sut.analyze(code)

      // Assert
      expect(matcher.collect).toHaveBeenCalledWith('DmlException')
    })

    it('Given matcher with populate, When analyze, Then populate is called after walk', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public void doWork() {}
        }
      `
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
        collectedTypes: new Set(),
        populate: vi.fn().mockResolvedValue(undefined),
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
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
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
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
        collectedTypes: new Set(),
        populate: vi.fn().mockResolvedValue(undefined),
      }
      const matcher2: TypeMatcher = {
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
        collectedTypes: new Set(),
        populate: vi.fn().mockResolvedValue(undefined),
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
        matches: vi.fn().mockImplementation((t: string) => t === 'Account'),
        collect: vi.fn(),
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

  describe('edge cases', () => {
    it('Given List return type with malformed generic, When analyze, Then no elementType', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public List getItems() {
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
          typeName: 'List',
        })
      )
      expect(result).not.toHaveProperty('elementType')
    })

    it('Given Set return type with malformed generic, When analyze, Then no elementType', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Set getItems() {
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
          typeName: 'Set',
        })
      )
      expect(result).not.toHaveProperty('elementType')
    })

    it('Given Map return type with malformed generic, When analyze, Then no elementType', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Map getItems() {
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
          typeName: 'Map',
        })
      )
      expect(result).not.toHaveProperty('elementType')
    })

    it('Given Set return type with proper generic, When analyze, Then elementType is extracted', async () => {
      // Arrange
      const code = `
        public class TestClass {
          public Set<Id> getIds() {
            return null;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('getIds')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.SET,
          typeName: 'Set<Id>',
          elementType: 'Id',
        })
      )
    })
  })

  describe('withMatcher fluent API', () => {
    it('Given withMatcher call, When chaining, Then returns same instance', () => {
      // Arrange
      const matcher: TypeMatcher = {
        matches: vi.fn(),
        collect: vi.fn(),
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
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
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
