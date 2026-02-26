@IsTest
private class MutationTest {
    @IsTest
    static void testAll() {
        Mutation m = new Mutation();
        Mutation.run(-1);
        Mutation.run(0);
        Mutation.num(0);
        Mutation.flag();
        Mutation.flag2();
    }
}
