import type { Mocked } from 'vitest'
import type { SObjectSchemaProvider } from '../../../src/port/sObjectSchemaProvider.js'
import {
  AliasTypeMatcher,
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../../src/service/typeMatcher.js'
import { APEX_TYPE } from '../../../src/type/ApexMethod.js'

describe('ApexClassTypeMatcher', () => {
  let sut: ApexClassTypeMatcher

  beforeEach(() => {
    sut = new ApexClassTypeMatcher(
      new Set(['MyService', 'AccountHandler', 'Utils'])
    )
  })

  describe('Given a known Apex class type, When matches is called, Then it returns true', () => {
    it.each(['MyService', 'AccountHandler', 'Utils'])('for %s', typeName => {
      expect(sut.matches(typeName)).toBe(true)
    })
  })

  describe('Given an unknown type, When matches is called, Then it returns false', () => {
    it.each(['Account', 'String', 'UnknownClass'])('for %s', typeName => {
      expect(sut.matches(typeName)).toBe(false)
    })
  })

  describe('collect', () => {
    it('Given a matching type, When collect is called, Then it adds the type to collectedTypes', () => {
      // Act
      sut.collect('MyService')

      // Assert
      expect(sut.collectedTypes.has('MyService')).toBe(true)
    })

    it('Given a non-matching type, When collect is called, Then it does not add the type to collectedTypes', () => {
      // Act
      sut.collect('UnknownClass')

      // Assert
      expect(sut.collectedTypes.size).toBe(0)
    })

    it('Given multiple matching types, When collect is called for each, Then collectedTypes contains all of them', () => {
      // Act
      sut.collect('MyService')
      sut.collect('Utils')

      // Assert
      expect(sut.collectedTypes).toEqual(new Set(['MyService', 'Utils']))
    })

    it('Given the same type collected twice, When collectedTypes is read, Then it contains the type only once', () => {
      // Act
      sut.collect('MyService')
      sut.collect('MyService')

      // Assert
      expect(sut.collectedTypes.size).toBe(1)
    })
  })

  describe('collectedTypes', () => {
    it('Given no types collected, When collectedTypes is read, Then it returns an empty set', () => {
      // Assert
      expect(sut.collectedTypes.size).toBe(0)
    })
  })
})

describe('SObjectTypeMatcher', () => {
  let sut: SObjectTypeMatcher
  let mockDescribeRepository: Mocked<SObjectSchemaProvider>

  beforeEach(() => {
    mockDescribeRepository = {
      describe: vi.fn().mockResolvedValue(undefined),
      resolveFieldType: vi.fn(),
    } as unknown as Mocked<SObjectSchemaProvider>
    sut = new SObjectTypeMatcher(
      new Set(['Account', 'Contact', 'Custom__c']),
      mockDescribeRepository
    )
  })

  describe('Given a known sObject type, When matches is called, Then it returns true', () => {
    it.each(['Account', 'Contact', 'Custom__c'])('for %s', typeName => {
      expect(sut.matches(typeName)).toBe(true)
    })
  })

  describe('Given an unknown type, When matches is called, Then it returns false', () => {
    it.each(['String', 'Integer', 'MyClass'])('for %s', typeName => {
      expect(sut.matches(typeName)).toBe(false)
    })
  })

  describe('collect', () => {
    it('Given a matching type, When collect is called, Then it adds the type to collectedTypes', () => {
      // Act
      sut.collect('Account')

      // Assert
      expect(sut.collectedTypes.has('Account')).toBe(true)
    })

    it('Given a non-matching type, When collect is called, Then it does not add the type to collectedTypes', () => {
      // Act
      sut.collect('String')

      // Assert
      expect(sut.collectedTypes.size).toBe(0)
    })

    it('Given multiple matching types, When collect is called for each, Then collectedTypes contains all of them', () => {
      // Act
      sut.collect('Account')
      sut.collect('Contact')

      // Assert
      expect(sut.collectedTypes).toEqual(new Set(['Account', 'Contact']))
    })

    it('Given the same type collected twice, When collectedTypes is read, Then it contains the type only once', () => {
      // Act
      sut.collect('Account')
      sut.collect('Account')

      // Assert
      expect(sut.collectedTypes).toEqual(new Set(['Account']))
    })
  })

  describe('collectedTypes', () => {
    it('Given no types collected, When collectedTypes is read, Then it returns an empty set', () => {
      // Assert
      expect(sut.collectedTypes.size).toBe(0)
    })
  })

  describe('populate', () => {
    it('Given collected types, When populate is called, Then it calls schema.describe with collected types', async () => {
      // Arrange
      sut.collect('Account')
      sut.collect('Contact')

      // Act
      await sut.populate()

      // Assert
      expect(mockDescribeRepository.describe).toHaveBeenCalledWith([
        'Account',
        'Contact',
      ])
    })

    it('Given no collected types, When populate is called, Then it calls schema.describe with empty array', async () => {
      // Act
      await sut.populate()

      // Assert
      expect(mockDescribeRepository.describe).toHaveBeenCalledWith([])
    })

    it('Given no schema, When populate is called, Then it resolves without error', async () => {
      // Arrange
      const matcherWithoutRepo = new SObjectTypeMatcher(new Set(['Account']))

      // Act & Assert
      await expect(matcherWithoutRepo.populate()).resolves.toBeUndefined()
    })
  })

  describe('getFieldType', () => {
    it('Given a described sObject, When getFieldType is called, Then it delegates to schema.resolveFieldType', () => {
      // Arrange
      mockDescribeRepository.resolveFieldType.mockReturnValue(APEX_TYPE.STRING)

      // Act
      const result = sut.getFieldType('Account', 'Name')

      // Assert
      expect(mockDescribeRepository.resolveFieldType).toHaveBeenCalledWith(
        'Account',
        'Name'
      )
      expect(result).toBe(APEX_TYPE.STRING)
    })

    it('Given an unknown field, When getFieldType is called, Then it returns undefined', () => {
      // Arrange
      mockDescribeRepository.resolveFieldType.mockReturnValue(undefined)

      // Act
      const result = sut.getFieldType('Account', 'UnknownField')

      // Assert
      expect(result).toBeUndefined()
    })

    it('Given no schema, When getFieldType is called, Then it returns undefined without throwing', () => {
      // Arrange
      const matcherWithoutRepo = new SObjectTypeMatcher(new Set(['Account']))

      // Act
      const result = matcherWithoutRepo.getFieldType('Account', 'Name')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('Given no schema, When constructed without one', () => {
    it('Then matches still works correctly', () => {
      // Arrange
      const matcherWithoutRepo = new SObjectTypeMatcher(
        new Set(['Account', 'Contact'])
      )

      // Assert
      expect(matcherWithoutRepo.matches('Account')).toBe(true)
      expect(matcherWithoutRepo.matches('Unknown')).toBe(false)
    })
  })
})

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

    describe("Given a real type whose api name collides with another type's alias", () => {
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
          },
        ],
        mockDescribeRepository
      )
    })

    it('Given collected types, When populate is called, Then describe receives the canonical api names', async () => {
      // Arrange
      sut.collect('ProbeObj__c')

      // Act
      await sut.populate()

      // Assert
      expect(mockDescribeRepository.describe).toHaveBeenCalledWith([
        'namespaced__ProbeObj__c',
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
