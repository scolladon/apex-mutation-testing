@IsTest
private class MutationTest {
	
    @IsTest
    static void unit_doThing_thenDoNothings() {
        // Arrange
        System.Debug('Nothing to arrange here');
        
        // Act
        Integer result = Mutation.doThings();
       
        
        // Assert
        Assert.areEqual(result, 7);
    }
}