import { TypeDiscoverer } from '../../src/service/typeDiscoverer.js'
import { AliasTypeMatcher } from '../../src/service/typeMatcher.js'
import { APEX_TYPE } from '../../src/type/ApexMethod.js'
import type { TypeRegistry } from '../../src/type/TypeRegistry.js'

describe('Type resolution naming Integration', () => {
  describe('Given source referencing a namespaced sObject, a foreign-namespace Apex class and a standard object, all by their bare or dotted alias spelling', () => {
    const code = `
      public class ProbeCaller {
        public ProbeObj__c load() { return null; }
        public void run() {
          ProbeObj__c rec = new ProbeObj__c();
          devedapp.PostInstallScript script = new devedapp.PostInstallScript();
          Account acc = new Account();
        }
      }
    `

    let sObjectMatcher: AliasTypeMatcher
    let typeRegistry: TypeRegistry

    beforeEach(async () => {
      const apexClassMatcher = new AliasTypeMatcher([
        {
          apiName: 'devedapp.PostInstallScript',
          aliases: ['devedapp.PostInstallScript', 'PostInstallScript'],
        },
      ])
      sObjectMatcher = new AliasTypeMatcher([
        {
          apiName: 'namespaced__ProbeObj__c',
          aliases: ['namespaced__ProbeObj__c', 'ProbeObj__c'],
        },
        { apiName: 'Account', aliases: ['Account'] },
      ])
      const typeDiscoverer = new TypeDiscoverer()
        .withMatcher(apexClassMatcher)
        .withMatcher(sObjectMatcher)

      typeRegistry = await typeDiscoverer.analyze(code)
    })

    it('Then a local variable declared with the namespaced sObject alias resolves to OBJECT', () => {
      // Act & Assert
      expect(typeRegistry.resolveType('run', 'rec')?.apexType).toBe(
        APEX_TYPE.OBJECT
      )
    })

    it('Then a local variable declared with the foreign-namespace Apex class dotted spelling resolves to OBJECT', () => {
      // Act & Assert
      expect(typeRegistry.resolveType('run', 'script')?.apexType).toBe(
        APEX_TYPE.OBJECT
      )
    })

    it('Then a local variable declared with a standard object type resolves to OBJECT', () => {
      // Act & Assert
      expect(typeRegistry.resolveType('run', 'acc')?.apexType).toBe(
        APEX_TYPE.OBJECT
      )
    })

    it('Then collectedTypes on the sObject matcher holds the canonical api names', () => {
      // Act & Assert
      expect(sObjectMatcher.collectedTypes).toEqual(
        new Set(['namespaced__ProbeObj__c', 'Account'])
      )
    })

    it('Then the method return type declared with the alias spelling resolves to OBJECT', () => {
      // Act & Assert
      expect(typeRegistry.resolveType('load')?.apexType).toBe(APEX_TYPE.OBJECT)
    })
  })
})
