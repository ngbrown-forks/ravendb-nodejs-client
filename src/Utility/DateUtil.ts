import { throwError } from "../Exceptions/index.js";
import { format, parse } from "date-fns";

export interface DateUtilOpts {
    withTimezone?: boolean;
    useUtcDates?: boolean;
}

export class DateUtil {

    public static DEFAULT_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS'0000'";
    public static DEFAULT_DATE_TZ_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS'0000'XXX";

    public static default: DateUtil = new DateUtil({});

    public static utc: DateUtil = new DateUtil({ useUtcDates: true });

    public constructor(protected opts: DateUtilOpts) {}

    public static timestamp(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

    public static timestampMs(): number {
        return new Date().getTime();
    }

    public static zeroDate(): Date {
        return new Date(0);
    }

    public parse(dateString: string): Date {
        if (!dateString) {
            return null;
        }

        dateString = DateUtil.alignPrecision(dateString);
        let parsed: Date;
        if (this.opts.useUtcDates || this.opts.withTimezone || dateString.endsWith("Z")) {
            parsed = parse(dateString, DateUtil.DEFAULT_DATE_TZ_FORMAT, new Date());
        } else {
            parsed = parse(dateString, DateUtil.DEFAULT_DATE_FORMAT, new Date());
        }

        if (isNaN(parsed.getTime())) {
            throwError("InvalidArgumentException", `Could not parse date string '${dateString}'.`);
        }

        return parsed;
    }

    private static alignPrecision(date: string) {
        const hasZ = date.endsWith("Z");
        if (hasZ) {
            date = date.slice(0, -1);
        }
        const lastDot = date.lastIndexOf(".");
        const tzPlusIndex = date.indexOf("+", lastDot);
        const tzMinusIndex = date.indexOf("-", lastDot);
        const tzIndex = Math.max(tzPlusIndex, tzMinusIndex);
        let tzSuffix = "";
        if (tzIndex !== -1) {
            tzSuffix = date.substring(tzIndex);
            date = date.slice(0, tzIndex - 1);
        }

        const suffix = "0000" + tzSuffix + (hasZ ? "Z" : "");

        if (lastDot === -1 || lastDot < date.length - 3) {
            return date.slice(0, lastDot + 4) + suffix;
        }
        return date + suffix;
    }

    public stringify(date: Date): string {
        if (this.opts.useUtcDates) {
            const utcString = date.toISOString().slice(0, -1);

            return this.opts.withTimezone ? utcString + "0000+00:00" : utcString + "0000Z";
        }
        const dateFormat = this.opts.withTimezone
            ? DateUtil.DEFAULT_DATE_TZ_FORMAT
            : DateUtil.DEFAULT_DATE_FORMAT;
        return format(date, dateFormat);
    }

}
