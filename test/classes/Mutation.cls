public class Mutation {

    // MemberVariableMutator: field with initializer
    String label = 'default';

    // Original method — BoundaryCondition, Increment, RemoveConditionals, RemoveIncrements, EmptyReturn
    public static Integer doThings() {
        Integer i = 0;
        for(;i<10;++i) {
            if(i >= 7) {
                break;
            }
        }
        return i;
    }

    // EqualityConditionMutator: == and !=
    public static Boolean checkEquality(Integer a, Integer b) {
        Boolean result = (a == b);
        if (a != b) {
            result = false;
        }
        return result;
    }

    // LogicalOperatorMutator: && and ||
    public static Boolean checkLogic(Boolean a, Boolean b) {
        if (a && b) {
            return true;
        }
        if (a || b) {
            return true;
        }
        return false;
    }

    // ArithmeticOperatorMutator + ArithmeticOperatorDeletionMutator: +, -, *, /
    public static Integer doMath(Integer a, Integer b) {
        Integer sum = a + b;
        Integer diff = a - b;
        Integer product = a * b;
        Integer quotient = a / b;
        return sum + diff + product + quotient;
    }

    // NegationMutator: numeric return
    public static Integer negate(Integer x) {
        return x;
    }

    // InvertNegativesMutator: unary minus
    public static Integer invertNeg(Integer x) {
        return -x;
    }

    // ConstructorCallMutator: new expression
    public static List<String> createList() {
        return new List<String>();
    }

    // VoidMethodCallMutator: void method call
    public static void doLog(String msg) {
        System.debug(msg);
    }

    // NonVoidMethodCallMutator: non-void method assigned to variable
    public static String callNonVoid() {
        String result = getString();
        return result;
    }

    // TrueReturnMutator + FalseReturnMutator: Boolean return
    public static Boolean getTrue() {
        return true;
    }

    public static Boolean getFalse() {
        return false;
    }

    // NullReturnMutator: reference type return
    public static String getNullable(Boolean flag) {
        if (flag) {
            return 'value';
        }
        return null;
    }

    // UnaryOperatorInsertionMutator: variable in expression
    public static Integer useVariable(Integer x) {
        Integer y = x;
        return y;
    }

    // BitwiseOperatorMutator: &, |, ^
    public static Integer bitwiseOps(Integer a, Integer b) {
        Integer andResult = a & b;
        Integer orResult = a | b;
        Integer xorResult = a ^ b;
        return andResult + orResult + xorResult;
    }

    // SwitchMutator + ExperimentalSwitchMutator: switch/when blocks
    public static String checkSwitch(Integer x) {
        String result;
        switch on x {
            when 1 {
                result = 'one';
            }
            when 2 {
                result = 'two';
            }
            when else {
                result = 'other';
            }
        }
        return result;
    }

    // InlineConstantMutator: literals (String, Integer, Boolean, Decimal)
    public static String getLiteral() {
        String s = 'hello';
        Integer n = 42;
        Boolean b = true;
        Decimal d = 3.14;
        return s + n + b + d;
    }

    // ArgumentPropagationMutator: method call with type-compatible argument
    public static String propagateArg(String input) {
        return input.toUpperCase();
    }

    // NakedReceiverMutator: dot expression with type-compatible receiver
    public static String nakedReceiver(String input) {
        return input.toLowerCase();
    }

    private static String getString() {
        return 'test';
    }
}
