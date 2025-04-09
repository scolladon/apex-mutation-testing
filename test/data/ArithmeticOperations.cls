public class ArithmeticOperations {
    
    public Integer addNumbers(Integer a, Integer b) {
        Integer c =  a + b;
        return c;
    }
    
    public Integer subtractNumbers(Integer a, Integer b) {
        return a - b;
    }
    
    public Integer multiplyNumbers(Integer a, Integer b) {
        return a * b;
    }
    
    public Decimal divideNumbers(Integer a, Integer b) {
        if (b == 0) {
            return 0;
        }
        return a / b;
    }
    
    public Integer complexExpression(Integer a, Integer b, Integer c) {
        return a + b * c - (a / 2);
    }
    
    public Integer conditionalOperation(Integer a, Integer b) {
        if (a > b) {
            return a - b;
        } else {
            return b + a;
        }
    }
    
    public Integer loopOperation(Integer count) {
        Integer sum = 0;
        for (Integer i = 0; i < count; i++) {
            sum = sum + i;
        }
        return sum;
    }
}