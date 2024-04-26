import { QueryToken } from "./QueryToken.js";
import { StringBuilder } from "../../../Utility/StringBuilder.js";

export class TimingsToken extends QueryToken {
     private constructor() {
         super();
     }

    public static instance: TimingsToken = new TimingsToken();

    public writeTo(writer: StringBuilder): void {
        writer.append("timings()");
    }
}
