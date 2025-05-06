@IsTest
private class EmptyReturnsTest {
    @IsTest
    static void test_getStringList() {
        
        List<String> result = EmptyReturns.getStringList();
        
        Assert.areEqual(2, result.size());
        Assert.areEqual('test1', result[0]);
        Assert.areEqual('test2', result[1]);
    }

    @IsTest
    static void test_getIntegerList() {
        
        List<Integer> result = EmptyReturns.getIntegerList();
                
        Assert.areEqual(2, result.size());
        Assert.areEqual(1, result[0]);
        Assert.areEqual(2, result[1]);
    }
    
    @IsTest
    static void test_getStringIntegerMap() {
        
        Map<String, Integer> result = EmptyReturns.getStringIntegerMap();
        
        Assert.areEqual(2, result.size());
        Assert.areEqual(1, result.get('key1'));
        Assert.areEqual(2, result.get('key2'));
    }
    
    @IsTest
    static void test_getString() {
        
        String result = EmptyReturns.getString();
        
        Assert.areEqual('Hello, World!', result);
    }

    @IsTest
    static void test_getStringFromMethodCall() {
        
        String result = EmptyReturns.getStringFromMethodCall();
        
        Assert.areEqual('Hello, World!', result);
    }
    
    @IsTest
    static void test_getInteger() {
        
        Integer result = EmptyReturns.getInteger();
        
        Assert.areEqual(42, result);
    }
    
    @IsTest
    static void test_getBoolean() {
        
        Boolean result = EmptyReturns.getBoolean();
        
        Assert.isTrue(result);
    }

    @IsTest
    static void test_addString() {
        EmptyReturns returns = new EmptyReturns();
        
        String result = returns.addString();
        
        Assert.areEqual('Hello, World!Hello, World!', result);
    }

    @IsTest
    static void test_addStringLowerCase() {
        
        EmptyReturns returns = new EmptyReturns();
        
        String result = returns.addStringLowerCase();
        
        Assert.areEqual('hello, world!hello, world!', result);
    }

    @IsTest
    static void test_getDecimal() {
        
        Decimal result = EmptyReturns.getDecimal();
        
        Assert.areEqual(42.00, result);
    }

    @isTest 
    static void test_getLogger() {
        ILogger logger = EmptyReturns.getLogger();
        Assert.isInstanceOfType(logger, ILogger.class);
    }

    @isTest 
    static void test_getConsoleLogger() {
        ConsoleLogger logger = EmptyReturns.getConsoleLogger();
        Assert.isInstanceOfType(logger, ConsoleLogger.class);
    }

    @isTest 
    static void test_getConsoleLoggerAsObject() {
        Object logger = EmptyReturns.getConsoleLoggerAsObject();
        Assert.isInstanceOfType(logger, Object.class);
    }

    @IsTest
    static void test_complexExpression() {
        Integer a = 10;
        Integer b = 5;
        Integer c = 3;
        Integer expected = 10 + 5 * 3 - (10 / 2);
        
        Integer result = EmptyReturns.complexExpression(a, b, c);
        
        Assert.areEqual(20, result);
    }

        
    @IsTest
    static void test_getAnySObject() {
        sObject obj = EmptyReturns.getAnySObject();
        Assert.isInstanceOfType(obj, sObject.class);
    }

            
    @IsTest
    static void test_getAccount() {
        Account obj = EmptyReturns.getAccount();
        Assert.isInstanceOfType(obj, Account.class);
    }



}