import type { Mocked } from 'vitest'
import type { SObjectSchemaProvider } from '../../../src/port/sObjectSchemaProvider.js'
import { AliasTypeMatcher } from '../../../src/service/typeMatcher.js'

describe('AliasTypeMatcher', () => {
  describe('Given a matcher built without a schema', () => {
    describe('Given a matcher knowing Mutation and Utils', () => {
      let sut: AliasTypeMatcher

      beforeEach(() => {
        sut = new AliasTypeMatcher([
          { apiName: 'Mutation', aliases: ['Mutation'] },
          { apiName: 'Utils', aliases: ['Utils'] },
        ])
      })

      it.each(['Mutation', 'mutation', 'MUTATION'])(
        'Then matches returns true for %s',
        typeName => {
          // Act & Assert
          expect(sut.matches(typeName)).toBe(true)
        }
      )

      it('Given a non-matching type, When collect is called, Then collectedTypes stays empty', () => {
        // Act
        sut.collect('UnknownClass')

        // Assert
        expect(sut.collectedTypes.size).toBe(0)
      })

      it('Given no schema, When populate is called, Then it resolves without calling describe', async () => {
        // Act & Assert
        await expect(sut.populate()).resolves.toBeUndefined()
      })

      it('Given no schema, When getFieldType is called, Then it returns undefined without throwing', () => {
        // Act
        const result = sut.getFieldType('Mutation', 'Name')

        // Assert
        expect(result).toBeUndefined()
      })
    })

    describe('Given a matcher knowing a foreign-namespace Apex type and a namespaced object', () => {
      let sut: AliasTypeMatcher

      beforeEach(() => {
        sut = new AliasTypeMatcher([
          {
            apiName: 'devedapp.PostInstallScript',
            aliases: ['devedapp.PostInstallScript', 'PostInstallScript'],
          },
          {
            apiName: 'namespaced__ProbeObj__c',
            aliases: ['namespaced__ProbeObj__c', 'ProbeObj__c'],
          },
        ])
      })

      it.each([
        'devedapp.PostInstallScript',
        'PostInstallScript',
        'namespaced__ProbeObj__c',
        'ProbeObj__c',
      ])('Then matches returns true for %s', typeName => {
        // Act & Assert
        expect(sut.matches(typeName)).toBe(true)
      })

      it('Then matches returns false for the bare developer name of the namespaced object', () => {
        // Act & Assert
        expect(sut.matches('ProbeObj')).toBe(false)
      })

      it('Given a type collected by an alias, When collectedTypes is read, Then it holds the canonical api name', () => {
        // Act
        sut.collect('ProbeObj__c')

        // Assert
        expect(sut.collectedTypes).toEqual(new Set(['namespaced__ProbeObj__c']))
      })

      it('Given the same type collected in two casings, When collectedTypes is read, Then it holds one entry', () => {
        // Act
        sut.collect('ProbeObj__c')
        sut.collect('probeobj__c')

        // Assert
        expect(sut.collectedTypes.size).toBe(1)
      })
    })

    describe("Given a real type whose api name collides with another type's alias, with the aliasing type declared first", () => {
      let sut: AliasTypeMatcher

      beforeEach(() => {
        sut = new AliasTypeMatcher([
          {
            apiName: 'pkg__Amount__c',
            aliases: ['pkg__Amount__c', 'Amount__c'],
          },
          { apiName: 'Amount__c', aliases: ['Amount__c'] },
        ])
      })

      it('When matching that name, Then the real type wins', () => {
        // Act
        sut.collect('Amount__c')

        // Assert
        expect(sut.collectedTypes).toEqual(new Set(['Amount__c']))
      })
    })

    // The invariant must hold regardless of declaration order: registering
    // every canonical name in one pass before any alias is what makes this
    // ordering matter — with the real type declared first, plain
    // last-write-wins during the alias pass would let the second type's
    // alias overwrite it back, reproducing the guarded result by accident
    // rather than by the guard.
    describe("Given a real type whose api name collides with another type's alias, with the real type declared first", () => {
      let sut: AliasTypeMatcher

      beforeEach(() => {
        sut = new AliasTypeMatcher([
          { apiName: 'Amount__c', aliases: ['Amount__c'] },
          {
            apiName: 'pkg__Amount__c',
            aliases: ['pkg__Amount__c', 'Amount__c'],
          },
        ])
      })

      it('When matching that name, Then the real type still wins', () => {
        // Act
        sut.collect('Amount__c')

        // Assert
        expect(sut.collectedTypes).toEqual(new Set(['Amount__c']))
      })
    })
  })

  describe('Given a matcher built with a schema', () => {
    let sut: AliasTypeMatcher
    let mockDescribeRepository: Mocked<SObjectSchemaProvider>

    beforeEach(() => {
      mockDescribeRepository = {
        describe: vi.fn().mockResolvedValue(undefined),
        resolveFieldType: vi.fn(),
      } as unknown as Mocked<SObjectSchemaProvider>
      sut = new AliasTypeMatcher(
        [
          {
            apiName: 'namespaced__ProbeObj__c',
            aliases: ['namespaced__ProbeObj__c', 'ProbeObj__c'],
            namespace: 'namespaced',
          },
        ],
        mockDescribeRepository
      )
    })

    it('Given collected types, When populate is called, Then describe receives the canonical api name paired with its namespace', async () => {
      // Arrange
      sut.collect('ProbeObj__c')

      // Act
      await sut.populate()

      // Assert
      expect(mockDescribeRepository.describe).toHaveBeenCalledWith([
        { apiName: 'namespaced__ProbeObj__c', namespace: 'namespaced' },
      ])
    })

    it('Given a root type written as an alias, When getFieldType is called, Then the schema is asked about the canonical name', () => {
      // Act
      sut.getFieldType('ProbeObj__c', 'Amount__c')

      // Assert
      expect(mockDescribeRepository.resolveFieldType).toHaveBeenCalledWith(
        'namespaced__ProbeObj__c',
        'Amount__c'
      )
    })

    it('Given a non-sObject root type, When getFieldType is called, Then the caller spelling is passed through', () => {
      // Act
      sut.getFieldType('String', 'length')

      // Assert
      expect(mockDescribeRepository.resolveFieldType).toHaveBeenCalledWith(
        'String',
        'length'
      )
    })
  })
})
