@IsTest
private class MutationTest {
    // Three focused tests with disjoint coverage. Mutations on lines
    // touched by only one test don't share covering tests with mutations
    // touched by only a different test, so DSATUR (--mutation-grouping)
    // can collapse them into shared deploy + run batches. This makes the
    // e2e a real harness for the grouped path, not just a regression check.
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
