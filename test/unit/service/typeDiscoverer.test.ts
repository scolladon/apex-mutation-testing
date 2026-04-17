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

    it('Given enhanced-for loop, When analyze, Then collect is called with the loop variable type', async () => {
      // Arrange — verifies collectToMatchers is called from enterEnhancedForControl (L141)
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
      await sut.analyze(code)

      // Assert — collect must be called with the loop variable type 'Account'
      expect(matcher.collect).toHaveBeenCalledWith('Account')
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

  describe('formal parameter with modifier', () => {
    it('Given formal parameter with annotation, When analyze, Then parameter type is resolved correctly', async () => {
      // Arrange — formalParameter with annotation has 3 children: [modifier, type, name]
      // The code uses ctx.children[length - 2] for type and [length - 1] for name,
      // which correctly handles both 2-child (plain) and 3-child (annotated) cases.
      const code = `
        public class TestClass {
          public Integer calculate(@AuraEnabled Decimal rate) {
            return 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — type 'Decimal' is at length-2 regardless of annotation prefix
      const result = registry.resolveType('calculate', 'rate')
      expect(result).toEqual({
        apexType: APEX_TYPE.DECIMAL,
        typeName: 'decimal',
      })
    })

    it('Given formal parameter with final modifier, When analyze, Then parameter type is resolved correctly', async () => {
      // Arrange — formalParameter with 'final' modifier also has 3 children: [final, type, name]
      const code = `
        public class TestClass {
          public String format(final Integer value) {
            return '';
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — length-2 gives 'Integer', not 'final' (which would be at length-3)
      const result = registry.resolveType('format', 'value')
      expect(result).toEqual({
        apexType: APEX_TYPE.INTEGER,
        typeName: 'integer',
      })
    })

    it('Given formal parameter with annotation, When analyze, Then collect is called with the annotated parameter type', async () => {
      // Arrange — verifies collectToMatchers in enterFormalParameter works with annotations
      const code = `
        public class TestClass {
          public void process(@AuraEnabled Account record) {}
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

      // Assert — 'Account' type is collected even when the parameter has an annotation
      expect(matcher.collect).toHaveBeenCalledWith('Account')
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

  describe('variable tracking — loop and filter edge cases', () => {
    it('Given local variable declaration, When analyze, Then type name itself is NOT tracked as variable', async () => {
      // Arrange — kills mutation i=0 (which would track type name as variable name)
      const code = `
        public class TestClass {
          public void process() {
            String name = 'test';
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — 'String' should not be a variable in scope
      expect(registry.resolveType('process', 'String')).toBeNull()
      expect(registry.resolveType('process', 'name')).not.toBeNull()
    })

    it('Given variable declaration with initializer, When analyze, Then variable name (not equals sign) is tracked', async () => {
      // Arrange — exercises the childText !== '=' filter in the loop
      const code = `
        public class TestClass {
          public void process() {
            Integer count = 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — variable 'count' tracked, '=' not tracked as variable
      expect(registry.resolveType('process', 'count')).toEqual({
        apexType: APEX_TYPE.INTEGER,
        typeName: 'integer',
      })
      expect(registry.resolveType('process', '=')).toBeNull()
    })

    it('Given field declaration without initializer, When analyze, Then field is tracked', async () => {
      // Arrange — exercises trackVariableDeclaration for fields
      const code = `
        public class TestClass {
          Integer count;
          public void process() {}
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — field tracked, type name itself not tracked as field
      expect(registry.resolveType('process', 'count')).toEqual({
        apexType: APEX_TYPE.INTEGER,
        typeName: 'integer',
      })
      expect(registry.resolveType('process', 'Integer')).toBeNull()
    })

    it('Given multiple local variables declared together, When analyze, Then first variable name is extracted via split', async () => {
      // Arrange — the VariableDeclaratorsContext text is "a=0,b=1"; split('=')[0] extracts 'a'
      // This distinguishes split('=') from split('') (which would yield just 'a' by coincidence
      // for single chars but fail for multi-char names like the next test covers)
      const code = `
        public class TestClass {
          public void process() {
            String greeting = 'hello', farewell = 'bye';
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — the VariableDeclaratorsContext text is "greeting='hello',farewell='bye'"
      // split('=')[0] = 'greeting' (the first variable name before the '=')
      // A split('') mutant would yield 'g' instead of 'greeting'
      expect(registry.resolveType('process', 'greeting')).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })
    })

    it('Given field with initializer, When analyze, Then field name is extracted correctly via split on equals', async () => {
      // Arrange — VariableDeclaratorsContext text is "label='default'" for `String label = 'default';`
      // split('=')[0] = 'label' (correct variable name)
      // A split('') mutant would yield 'l' (first char only)
      const code = `
        public class TestClass {
          String label = 'default';
          public void process() {}
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — 'label' is correctly extracted by split('=')[0]; 'l' (from split('')[0]) would not match
      expect(registry.resolveType('process', 'label')).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })
      expect(registry.resolveType('process', 'l')).toBeNull()
    })

    it('Given comma is never a direct child of localVariableDeclaration, When analyze, Then comma is not tracked as a variable name', async () => {
      // Arrange — the ',' filter in trackVariableDeclaration protects against comma leaking in.
      // In ANTLR's Apex grammar, multiple declarators are grouped in a VariableDeclaratorsContext,
      // so ',' never appears as a direct child of localVariableDeclaration.
      // This test documents and verifies that intent: comma must not become a variable name.
      const code = `
        public class TestClass {
          public void process() {
            Integer a = 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — ',' is never tracked as a variable regardless of && vs || in the filter
      expect(registry.resolveType('process', ',')).toBeNull()
      // 'a' is correctly tracked as an Integer variable
      expect(registry.resolveType('process', 'a')).toEqual({
        apexType: APEX_TYPE.INTEGER,
        typeName: 'integer',
      })
    })

    it('Given equals sign is never a direct child of localVariableDeclaration, When analyze, Then equals is not tracked as a variable name', async () => {
      // Arrange — the '=' filter in trackVariableDeclaration protects against '=' leaking in.
      // The VariableDeclaratorsContext wraps declarators so '=' never appears at the declaration level.
      // This confirms the filter's intent: '=' must not become a variable name.
      const code = `
        public class TestClass {
          public void process() {
            String message = 'hello';
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — '=' is never tracked as a variable name
      expect(registry.resolveType('process', '=')).toBeNull()
      // 'message' is tracked correctly
      expect(registry.resolveType('process', 'message')).toEqual({
        apexType: APEX_TYPE.STRING,
        typeName: 'string',
      })
    })
  })

  describe('analyze — parse and populate sequence', () => {
    it('Given valid Apex code, When analyze is called, Then parsing succeeds and returns TypeRegistry', async () => {
      // Arrange — exercises the CaseInsensitiveInputStream construction in analyze (L191)
      // The filename argument 'other' is a source-name hint; parsing result must be correct
      // regardless of what string is passed as the filename.
      const code = `
        public class TestClass {
          public Integer getValue() {
            return 42;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — successful parse produces a working registry
      const result = registry.resolveType('getValue')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.INTEGER,
          typeName: 'Integer',
        })
      )
    })

    it('Given class with multiple methods, When analyze, Then each method has its own isolated variable scope', async () => {
      // Arrange — verifies that exitMethodDeclaration correctly saves and resets scope for each method
      // A BlockStatement mutant on exitMethodDeclaration body would break variable isolation.
      const code = `
        public class TestClass {
          public void methodA() {
            Boolean flag = true;
          }
          public void methodB() {
            Date today = Date.today();
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — each method has only its own variable
      expect(registry.resolveType('methodA', 'flag')).toEqual({
        apexType: APEX_TYPE.BOOLEAN,
        typeName: 'boolean',
      })
      expect(registry.resolveType('methodB', 'today')).toEqual({
        apexType: APEX_TYPE.DATE,
        typeName: 'date',
      })
      // Variables must not bleed across methods
      expect(registry.resolveType('methodA', 'today')).toBeNull()
      expect(registry.resolveType('methodB', 'flag')).toBeNull()
    })

    it('Given matchers with populate, When analyze, Then populate is called after all types are collected', async () => {
      // Arrange — verifies the post-walk populate loop in analyze (L203-205)
      // A BlockStatement mutant on the loop body would prevent populate from being called.
      let collectCalledBeforePopulate = false
      const matcher: TypeMatcher = {
        matches: vi.fn().mockReturnValue(false),
        collect: vi.fn(),
        collectedTypes: new Set(),
        populate: vi.fn().mockImplementation(async () => {
          // By the time populate is called, collect should already have been called
          collectCalledBeforePopulate =
            (matcher.collect as ReturnType<typeof vi.fn>).mock.calls.length > 0
        }),
      }
      const code = `
        public class TestClass {
          String field;
          public void doWork() {}
        }
      `
      const sut = new TypeDiscoverer().withMatcher(matcher)

      // Act
      await sut.analyze(code)

      // Assert — populate was called AFTER collect (walk happened first)
      expect(matcher.populate).toHaveBeenCalledOnce()
      expect(collectCalledBeforePopulate).toBe(true)
    })
  })

  describe('return type classification — startsWith and endsWith branches', () => {
    it('Given method returning Boolean type, When analyze, Then classifies as BOOLEAN', async () => {
      // Arrange — exercises a primitive type not covered by list/set/map/array branches
      const code = `
        public class TestClass {
          public Boolean isValid() {
            return true;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      expect(registry.resolveType('isValid')).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.BOOLEAN,
          typeName: 'Boolean',
        })
      )
    })

    it('Given method with no elementType (plain return type), When analyze, Then result has no elementType property', async () => {
      // Arrange — the elementType is only set when the `if (elementType !== undefined)` guard passes.
      // A mutant flipping !== to === would incorrectly skip setting elementType.
      // Conversely, a mutant always entering the endsWith('[]') branch would add an elementType
      // to plain types. This test asserts that plain types produce no elementType.
      const code = `
        public class TestClass {
          public String getName() {
            return '';
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — plain String return type must NOT have an elementType property
      const result = registry.resolveType('getName')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.STRING,
          typeName: 'String',
        })
      )
      expect(result).not.toHaveProperty('elementType')
    })

    it('Given method returning Integer type, When analyze, Then result has no elementType property', async () => {
      // Arrange — verifies that the endsWith('[]') branch does not fire for non-array types.
      // A mutant replacing '[]' with '' would cause endsWith('') = true for all types,
      // incorrectly setting an elementType. This test makes that visible.
      const code = `
        public class TestClass {
          public Integer count() {
            return 0;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — Integer return type must NOT have an elementType property
      const result = registry.resolveType('count')
      expect(result).toEqual(
        expect.objectContaining({
          apexType: APEX_TYPE.INTEGER,
          typeName: 'Integer',
        })
      )
      expect(result).not.toHaveProperty('elementType')
    })

    it('Given method returning void type, When analyze, Then result has no elementType property', async () => {
      // Arrange — verifies void methods also produce no spurious elementType
      const code = `
        public class TestClass {
          public void execute() {}
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert — void return type must NOT have an elementType property
      const result = registry.resolveType('execute')
      expect(result).not.toHaveProperty('elementType')
    })

    it('Given method returning List type, When analyze, Then result has no elementType for plain List', async () => {
      // Arrange — plain 'List' (no generic) falls through list< check and must not get elementType
      // from the endsWith('[]') branch. This pair with the malformed-generic test.
      const code = `
        public class TestClass {
          public List fetch() {
            return null;
          }
        }
      `
      const sut = new TypeDiscoverer()

      // Act
      const registry = await sut.analyze(code)

      // Assert
      const result = registry.resolveType('fetch')
      expect(result).not.toHaveProperty('elementType')
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

  describe('method overload handling (H2)', () => {
    it('Given class with two overloads, Then methodTypeTable stores each under name+arity key AND name-only key points at the first overload', async () => {
      // Arrange — two overloads of `doWork`: arity 0 returns Integer, arity 2 returns String.
      const code = `
        public class Overloaded {
          public Integer doWork() { return 0; }
          public String doWork(Integer a, String b) { return ''; }
        }
      `
      const typeDiscoverer = new TypeDiscoverer()

      // Act
      const analysis = await typeDiscoverer.analyzeFull(code)

      // Assert — each overload resolvable under its arity-qualified key
      const typeRegistry = analysis.typeRegistry as unknown as {
        methodTypeTable: Map<string, { returnType: string }>
      }
      const byName0 = typeRegistry.methodTypeTable.get('doWork/0')
      const byName2 = typeRegistry.methodTypeTable.get('doWork/2')
      expect(byName0?.returnType).toBe('Integer')
      expect(byName2?.returnType).toBe('String')

      // Assert — name-only key returns the first-declared overload (deterministic)
      const byNameOnly = typeRegistry.methodTypeTable.get('doWork')
      expect(byNameOnly?.returnType).toBe('Integer')
    })

    it('Given overload with generic params (depth tracking), Then arity counts top-level commas only', async () => {
      // Arrange — Map<String,Integer> contains an internal comma that must NOT be
      // counted. The arity is 2 (the Map param + the second param).
      const code = `
        public class Generics {
          public void process(Map<String,Integer> data, String label) { }
        }
      `
      const typeDiscoverer = new TypeDiscoverer()

      // Act
      const analysis = await typeDiscoverer.analyzeFull(code)

      // Assert
      const typeRegistry = analysis.typeRegistry as unknown as {
        methodTypeTable: Map<string, { returnType: string }>
      }
      expect(typeRegistry.methodTypeTable.has('process/2')).toBe(true)
    })
  })
})
