@IsTest
private class MutationBulkTest {
    // The method name collides with MutationTest.testNum on purpose: two
    // same-named methods in different classes are exactly what a bare method
    // name cannot tell apart.
    //
    // Coverage is deliberately narrow — only Mutation.num. Mirroring
    // MutationTest's whole partition instead would attach a second method to
    // every mutant it already covers, which doubles the run's async-test
    // consumption against a hard org cap while leaving the grouping conflict
    // graph isomorphic. Narrow coverage also keeps mutants on Mutation.run and
    // Mutation.flag attributed to a single class, so per-class attribution is
    // observable in the report rather than every mutant naming both classes.
    @IsTest
    static void testNum() {
        Mutation.num(1);
    }
}
