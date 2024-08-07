import { assertThat } from "../Utils/AssertExtensions.js";
import { DatesComparator, leftDate, rightDate } from "../../src/Primitives/DatesComparator.js";
import { addDays } from "date-fns";

describe("DatesComparatorTest", function () {

    it("canCompareDefinedDates", () => {
        const first = new Date();
        const second = addDays(new Date(), 1);

        assertThat(DatesComparator.compare(leftDate(first), rightDate(second)))
            .isLessThan(0);

        assertThat(DatesComparator.compare(leftDate(first), rightDate(first)))
            .isEqualTo(0);
    });

    it("canCompareDatesWithNullUsingContext", () => {
        const first = new Date();

        assertThat(DatesComparator.compare(leftDate(first), rightDate(null)))
            .isLessThan(0);

        assertThat(DatesComparator.compare(leftDate(null), rightDate(first)))
            .isLessThan(0);

        assertThat(DatesComparator.compare(leftDate(null), rightDate(null)))
            .isLessThan(0);

        assertThat(DatesComparator.compare(leftDate(null), leftDate(null)))
            .isEqualTo(0);

        assertThat(DatesComparator.compare(rightDate(null), rightDate(null)))
            .isEqualTo(0);
    });
});
