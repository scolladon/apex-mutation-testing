import { TypeGatherer } from '../../../src/service/typeGatherer.js'
import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../../src/service/typeMatcher.js'
import { ApexType } from '../../../src/type/ApexMethod.js'

describe('TypeGatherer', () => {
  const apexClassMatcher = new ApexClassTypeMatcher(
    new Set(['CustomApexClass'])
  )
  const sObjectMatcher = new SObjectTypeMatcher(
    new Set(['Account', 'Contact', 'CustomObject__c'])
  )

  let sut: TypeGatherer

  beforeEach(() => {
    sut = new TypeGatherer(apexClassMatcher, sObjectMatcher)
  })

  describe('method return type classification', () => {
    it('Given void return type, When analyze, Then classifies as VOID', () => {
      const code = `
        public class TestClass {
          public void doWork() {}
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({ returnType: 'void', type: ApexType.VOID })
      )
    })

    it('Given Boolean return type, When analyze, Then classifies as BOOLEAN', () => {
      const code = `
        public class TestClass {
          public Boolean doWork() { return true; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Boolean',
          type: ApexType.BOOLEAN,
        })
      )
    })

    it('Given Integer return type, When analyze, Then classifies as INTEGER', () => {
      const code = `
        public class TestClass {
          public Integer doWork() { return 0; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Integer',
          type: ApexType.INTEGER,
        })
      )
    })

    it('Given Long return type, When analyze, Then classifies as LONG', () => {
      const code = `
        public class TestClass {
          public Long doWork() { return 0L; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({ returnType: 'Long', type: ApexType.LONG })
      )
    })

    it('Given Double return type, When analyze, Then classifies as DOUBLE', () => {
      const code = `
        public class TestClass {
          public Double doWork() { return 0.0; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Double',
          type: ApexType.DOUBLE,
        })
      )
    })

    it('Given Decimal return type, When analyze, Then classifies as DECIMAL', () => {
      const code = `
        public class TestClass {
          public Decimal doWork() { return 0.0; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Decimal',
          type: ApexType.DECIMAL,
        })
      )
    })

    it('Given String return type, When analyze, Then classifies as STRING', () => {
      const code = `
        public class TestClass {
          public String doWork() { return ''; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'String',
          type: ApexType.STRING,
        })
      )
    })

    it('Given ID return type, When analyze, Then classifies as ID', () => {
      const code = `
        public class TestClass {
          public ID doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({ returnType: 'ID', type: ApexType.ID })
      )
    })

    it('Given Blob return type, When analyze, Then classifies as BLOB', () => {
      const code = `
        public class TestClass {
          public Blob doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({ returnType: 'Blob', type: ApexType.BLOB })
      )
    })

    it('Given Date return type, When analyze, Then classifies as DATE', () => {
      const code = `
        public class TestClass {
          public Date doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({ returnType: 'Date', type: ApexType.DATE })
      )
    })

    it('Given DateTime return type, When analyze, Then classifies as DATETIME', () => {
      const code = `
        public class TestClass {
          public DateTime doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'DateTime',
          type: ApexType.DATETIME,
        })
      )
    })

    it('Given Time return type, When analyze, Then classifies as TIME', () => {
      const code = `
        public class TestClass {
          public Time doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({ returnType: 'Time', type: ApexType.TIME })
      )
    })

    it('Given SObject return type, When analyze, Then classifies as SOBJECT', () => {
      const code = `
        public class TestClass {
          public SObject doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'SObject',
          type: ApexType.SOBJECT,
        })
      )
    })

    it('Given Object return type, When analyze, Then classifies as OBJECT', () => {
      const code = `
        public class TestClass {
          public Object doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Object',
          type: ApexType.OBJECT,
        })
      )
    })

    it('Given List<String> return type, When analyze, Then classifies as LIST with elementType', () => {
      const code = `
        public class TestClass {
          public List<String> doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'List<String>',
          type: ApexType.LIST,
          elementType: 'String',
        })
      )
    })

    it('Given String[] return type, When analyze, Then classifies as LIST with elementType', () => {
      const code = `
        public class TestClass {
          public String[] doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'String[]',
          type: ApexType.LIST,
          elementType: 'String',
        })
      )
    })

    it('Given Set<String> return type, When analyze, Then classifies as SET with elementType', () => {
      const code = `
        public class TestClass {
          public Set<String> doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Set<String>',
          type: ApexType.SET,
          elementType: 'String',
        })
      )
    })

    it('Given Map<String,Integer> return type, When analyze, Then classifies as MAP with elementType', () => {
      const code = `
        public class TestClass {
          public Map<String,Integer> doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Map<String,Integer>',
          type: ApexType.MAP,
          elementType: 'String,Integer',
        })
      )
    })

    it('Given Apex class return type, When analyze, Then classifies as APEX_CLASS', () => {
      const code = `
        public class TestClass {
          public CustomApexClass doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'CustomApexClass',
          type: ApexType.APEX_CLASS,
        })
      )
    })

    it('Given standard entity return type, When analyze, Then classifies as SOBJECT', () => {
      const code = `
        public class TestClass {
          public Account doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'Account',
          type: ApexType.SOBJECT,
        })
      )
    })

    it('Given custom object return type, When analyze, Then classifies as SOBJECT', () => {
      const code = `
        public class TestClass {
          public CustomObject__c doWork() { return null; }
        }
      `
      const { methodTypeTable } = sut.analyze(code)
      expect(methodTypeTable.get('doWork')).toEqual(
        expect.objectContaining({
          returnType: 'CustomObject__c',
          type: ApexType.SOBJECT,
        })
      )
    })
  })

  describe('variable type gathering', () => {
    it('Given local variable with sObject type, When analyze, Then appears in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          public void test() {
            Account acc = new Account();
          }
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.has('Account')).toBe(true)
    })

    it('Given field with sObject type, When analyze, Then appears in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          Account acc;
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.has('Account')).toBe(true)
    })

    it('Given parameter with sObject type, When analyze, Then appears in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          public void test(Contact c) {}
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.has('Contact')).toBe(true)
    })

    it('Given for-each with sObject type, When analyze, Then appears in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          public void test() {
            List<Account> accs = new List<Account>();
            for (Account a : accs) {}
          }
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.has('Account')).toBe(true)
    })

    it('Given primitive type variable, When analyze, Then NOT in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          public void test() {
            Integer x = 5;
            String s = 'hello';
          }
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.size).toBe(0)
    })

    it('Given Apex class type variable, When analyze, Then NOT in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          public void test() {
            CustomApexClass obj = new CustomApexClass();
          }
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.size).toBe(0)
    })

    it('Given multiple sObject types, When analyze, Then all appear in usedSObjectTypes', () => {
      const code = `
        public class TestClass {
          Account acc;
          public void test(Contact c) {
            CustomObject__c obj = new CustomObject__c();
          }
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.has('Account')).toBe(true)
      expect(usedSObjectTypes.has('Contact')).toBe(true)
      expect(usedSObjectTypes.has('CustomObject__c')).toBe(true)
    })

    it('Given no sObject types used, When analyze, Then empty set', () => {
      const code = `
        public class TestClass {
          public Integer test() {
            Integer x = 5;
            return x;
          }
        }
      `
      const { usedSObjectTypes } = sut.analyze(code)
      expect(usedSObjectTypes.size).toBe(0)
    })
  })
})
