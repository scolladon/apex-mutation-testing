@IsTest
private class MutationBulkTest {
    // Method names collide with MutationTest's on purpose: this is the
    // second class in the multi-class perimeter, and it mirrors
    // MutationTest's disjoint coverage partition so --mutation-grouping
    // still sees a non-trivial conflict graph.
    @IsTest
    static void testRun() {
        Mutation.run(-1);
        Mutation.run(0);
    }

    @IsTest
    static void testNum() {
        Mutation.num(0);
    }

    @IsTest
    static void testFlag() {
        Mutation.flag();
        Mutation.flag2();
    }
}
