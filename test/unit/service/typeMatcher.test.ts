import {
  ApexClassTypeMatcher,
  SObjectTypeMatcher,
} from '../../../src/service/typeMatcher.js'

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
})

describe('SObjectTypeMatcher', () => {
  let sut: SObjectTypeMatcher

  beforeEach(() => {
    sut = new SObjectTypeMatcher(new Set(['Account', 'Contact', 'Custom__c']))
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
})
