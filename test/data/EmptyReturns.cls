public class EmptyReturns {

    String x; 

    public String addString(){
        x = getString() + getString();
        return x;
    }

    public string addStringLowerCase(){
        x = getString() + getString();
        return x.toLowerCase();
    }

    public static List<String> getStringList() {
        List<String> result = new List<String>();
        result.add('test1');
        result.add('test2');
        return result;
    }

    public static Integer[] getIntegerList() {
        List<Integer> result = new List<Integer>();
        result.add(1);
        result.add(2);
        return result;
    }
    
    public static Map<String, Integer> getStringIntegerMap() {
        Map<String, Integer> result = new Map<String, Integer>();
        result.put('key1', 1);
        result.put('key2', 2);
        return result;
    }
    
    public static String getString() {
        String x = 'Hello, World!';
        return x;
    }
    
    public static Integer getInteger() {
        return 42;
    } 

    public static Decimal getDecimal() {
        return 42.00;
    } 
    
    public static Boolean getBoolean() {
        Boolean x = true;
        return x;
    }
    
    public static List<String> getEmptyList() {
        return new List<String>();
    }
    
    public static String getEmptyString() {
        return '';
    }

    public static String getStringFromMethodCall() {
        return getString();
    }
    
    public static void doNothing() {
        System.debug('Doing nothing');
        return;
    }

    public static ILogger getLogger() {
        return new ConsoleLogger();
    }

    public static ConsoleLogger getConsoleLogger() {
        return new ConsoleLogger();
    }

    public static Object getConsoleLoggerAsObject() {
        return new ConsoleLogger();
    }

    public static sObject getAnySObject() {
        return new Account();
    }

    public static Account getAccount() {
        return new Account(Name='ABC CORP');
    }

    public static Integer complexExpression(Integer a, Integer b, Integer c) {
        return a + b * c - (a / 2);
    }
}