import { QueryToken } from "./QueryToken.js";
import { DateUtil } from "../../../Utility/DateUtil.js";
import { StringBuilder } from "../../../Utility/StringBuilder.js";
import { StringUtil } from "../../../Utility/StringUtil.js";


export class RevisionIncludesToken extends QueryToken {
    private readonly _dateTime: string;
    private readonly _path: string;

    private constructor(args: { date?: string, path?: string}) {
        super();

        this._dateTime = args.date;
        this._path = args.path;
    }

    public static createForDate(dateTime: Date) {
        return new RevisionIncludesToken({
            date: DateUtil.default.stringify(dateTime),
        });
    }

    public static createForPath(path: string) {
        return new RevisionIncludesToken({
            path
        });
    }

    writeTo(writer: StringBuilder) {
        writer.append("revisions('");
        if (this._dateTime) {
            writer.append(this._dateTime);
        } else if (!StringUtil.isNullOrWhitespace(this._path)) {
            writer.append(this._path);
        }

        writer.append("')");
    }
}
