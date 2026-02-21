import { SObjectDescribeRepository } from '../../../src/adapter/sObjectDescribeRepository.js'
import {
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
  let mockDescribeRepository: jest.Mocked<SObjectDescribeRepository>

  beforeEach(() => {
    mockDescribeRepository = {
      describe: jest.fn().mockResolvedValue(undefined),
      isSObject: jest.fn(),
      resolveFieldType: jest.fn(),
    } as unknown as jest.Mocked<SObjectDescribeRepository>
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
    it('Given collected types, When populate is called, Then it calls describeRepository.describe with collected types', async () => {
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

    it('Given no collected types, When populate is called, Then it calls describeRepository.describe with empty array', async () => {
      // Act
      await sut.populate()

      // Assert
      expect(mockDescribeRepository.describe).toHaveBeenCalledWith([])
    })

    it('Given no describeRepository, When populate is called, Then it resolves without error', async () => {
      // Arrange
      const matcherWithoutRepo = new SObjectTypeMatcher(new Set(['Account']))

      // Act & Assert
      await expect(matcherWithoutRepo.populate()).resolves.toBeUndefined()
    })
  })

  describe('getFieldType', () => {
    it('Given a described sObject, When getFieldType is called, Then it delegates to describeRepository.resolveFieldType', () => {
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
  })

  describe('Given no describeRepository, When constructed without one', () => {
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
