@IsTest
private class MutationTest {

    @IsTest
    static void test_doThings() {
        Integer result = Mutation.doThings();
        Assert.areEqual(7, result);
    }

    @IsTest
    static void test_checkEquality() {
        Boolean result1 = Mutation.checkEquality(1, 1);
        Boolean result2 = Mutation.checkEquality(1, 2);
        Assert.isNotNull(result1);
        Assert.isNotNull(result2);
    }

    @IsTest
    static void test_checkLogic() {
        Boolean result1 = Mutation.checkLogic(true, true);
        Boolean result2 = Mutation.checkLogic(true, false);
        Boolean result3 = Mutation.checkLogic(false, false);
        Assert.isNotNull(result1);
        Assert.isNotNull(result2);
        Assert.isNotNull(result3);
    }

    @IsTest
    static void test_doMath() {
        Integer result = Mutation.doMath(10, 2);
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_negate() {
        Integer result = Mutation.negate(5);
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_invertNeg() {
        Integer result = Mutation.invertNeg(5);
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_createList() {
        List<String> result = Mutation.createList();
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_doLog() {
        Mutation.doLog('test');
    }

    @IsTest
    static void test_callNonVoid() {
        String result = Mutation.callNonVoid();
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_getTrue() {
        Boolean result = Mutation.getTrue();
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_getFalse() {
        Boolean result = Mutation.getFalse();
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_getNullable() {
        String result1 = Mutation.getNullable(true);
        String result2 = Mutation.getNullable(false);
        Assert.isNotNull(result1);
    }

    @IsTest
    static void test_useVariable() {
        Integer result = Mutation.useVariable(5);
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_bitwiseOps() {
        Integer result = Mutation.bitwiseOps(6, 3);
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_checkSwitch() {
        String result1 = Mutation.checkSwitch(1);
        String result2 = Mutation.checkSwitch(2);
        String result3 = Mutation.checkSwitch(99);
        Assert.isNotNull(result1);
        Assert.isNotNull(result2);
        Assert.isNotNull(result3);
    }

    @IsTest
    static void test_getLiteral() {
        String result = Mutation.getLiteral();
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_propagateArg() {
        String result = Mutation.propagateArg('hello');
        Assert.isNotNull(result);
    }

    @IsTest
    static void test_nakedReceiver() {
        String result = Mutation.nakedReceiver('HELLO');
        Assert.isNotNull(result);
    }
}
