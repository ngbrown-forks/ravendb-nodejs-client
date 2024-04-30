import { QueryToken } from "./QueryToken.js";

export class DistinctToken extends QueryToken {

    private constructor() {
        super();
    }

    public static INSTANCE: DistinctToken = new DistinctToken();

    public writeTo(writer): void {
        writer.append("distinct");
    }
}
