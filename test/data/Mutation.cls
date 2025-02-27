public class Mutation {

    public static Integer doThings() {
        Integer i = 0;
        for(;i<10;++i) {
            if(i >= 7) {
                return i;
            }
        }
        return i;
    }
}