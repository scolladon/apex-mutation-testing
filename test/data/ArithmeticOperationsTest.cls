@IsTest
private class ArithmeticOperationsTest {
    
    @IsTest
    static void testAddNumbers() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.addNumbers(5, 3);
        
        // Assert
        System.assertEquals(8, result, 'Addition should work correctly');
    }
    
    @IsTest
    static void testSubtractNumbers() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.subtractNumbers(10, 4);
        
        // Assert
        System.assertEquals(6, result, 'Subtraction should work correctly');
    }
    
    @IsTest
    static void testMultiplyNumbers() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.multiplyNumbers(3, 5);
        
        // Assert
        System.assertEquals(15, result, 'Multiplication should work correctly');
    }
    
    @IsTest
    static void testDivideNumbers() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Decimal result = ops.divideNumbers(10, 2);
        
        // Assert
        System.assertEquals(5, result, 'Division should work correctly');
    }
    
    @IsTest
    static void testDivideByZero() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Decimal result = ops.divideNumbers(10, 0);
        
        // Assert
        System.assertEquals(0, result, 'Division by zero should return 0');
    }
    
    @IsTest
    static void testComplexExpression() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.complexExpression(10, 5, 3);
        
        // Assert
        // 10 + 5*3 - (10/2) = 10 + 15 - 5 = 20
        System.assertEquals(20, result, 'Complex expression should calculate correctly');
    }
    
    @IsTest
    static void testConditionalOperationWhenAGreaterThanB() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.conditionalOperation(10, 5);
        
        // Assert
        System.assertEquals(5, result, 'Should subtract when a > b');
    }
    
    @IsTest
    static void testConditionalOperationWhenALessThanB() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.conditionalOperation(5, 10);
        
        // Assert
        System.assertEquals(15, result, 'Should add when a <= b');
    }
    
    @IsTest
    static void testLoopOperation() {
        // Arrange
        ArithmeticOperations ops = new ArithmeticOperations();
        
        // Act
        Integer result = ops.loopOperation(5);
        
        // Assert
        // sum = 0 + 0 + 1 + 2 + 3 + 4 = 10
        System.assertEquals(10, result, 'Loop operation should sum correctly');
    }
}