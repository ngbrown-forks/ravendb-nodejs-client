import assert from "node:assert"
import moment from "moment";
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import {
    IDocumentStore,
    GetDocumentsCommand
} from "../../src/index.js";
import { DateUtil } from "../../src/Utility/DateUtil.js";
import { StringUtil } from "../../src/Utility/StringUtil.js";
import { assertThat } from "../Utils/AssertExtensions.js";


const momentDefaultDateFormat = "YYYY-MM-DDTHH:mm:ss.SSS0000";
const momentDefaultDateTzFormat = "YYYY-MM-DDTHH:mm:ss.SSS0000Z";

// getTimezoneOffset() returns reversed offset, hence the "-"
const LOCAL_TIMEZONE_OFFSET = -(new Date(2018, 7, 1).getTimezoneOffset()); 
const LOCAL_TIMEZONE_OFFSET_HOURS = LOCAL_TIMEZONE_OFFSET / 60;
const LOCAL_TIMEZONE_STRING =
    `${LOCAL_TIMEZONE_OFFSET >= 0 ? "+" : "-"}${StringUtil.leftPad(Math.abs(LOCAL_TIMEZONE_OFFSET_HOURS).toString(), 2, "0")}:00`;

const sampleDate = 1722862715782;

describe("DateUtil", function () {

    describe("stringify", () => {
        it ("utc no-timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: false,
                useUtcDates: true
            });

            assertThat(dateUtils.stringify(new Date(sampleDate)))
                .isEqualTo("2024-08-05T12:58:35.7820000Z");
        });

        it ("utc timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: true,
                useUtcDates: true
            });

            assertThat(dateUtils.stringify(new Date(sampleDate)))
                .isEqualTo("2024-08-05T12:58:35.7820000+00:00");
        });

        it ("no-utc no-timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: false,
                useUtcDates: false
            });

            assertThat(dateUtils.stringify(new Date(sampleDate)))
                .isEqualTo(`2024-08-05T${(12 + LOCAL_TIMEZONE_OFFSET_HOURS).toString().padStart(2, "0")}:58:35.7820000`);
        });

        it ("no-utc timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: true,
                useUtcDates: false
            });

            assertThat(dateUtils.stringify(new Date(sampleDate)))
                .isEqualTo(`2024-08-05T${(12 + LOCAL_TIMEZONE_OFFSET_HOURS).toString().padStart(2, "0")}:58:35.7820000` + LOCAL_TIMEZONE_STRING);
        });

    });

    describe("parse", () => {
        it ("utc no-timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: false,
                useUtcDates: true
            });

            assertThat(dateUtils.parse("2024-08-05T12:58:35.7820000Z").getTime())
                .isEqualTo(sampleDate);
        });

        it ("utc timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: true,
                useUtcDates: true
            });

            assertThat(dateUtils.parse("2024-08-05T12:58:35.7820000+00:00").getTime())
                .isEqualTo(sampleDate);
        });

        it ("no-utc no-timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: false,
                useUtcDates: false
            });

            assertThat(dateUtils.parse(`2024-08-05T${(12 + LOCAL_TIMEZONE_OFFSET_HOURS).toString().padStart(2, "0")}:58:35.7820000`).getTime())
                .isEqualTo(sampleDate);
        });

        it ("no-utc timezone", function () {
            const dateUtils = new DateUtil({
                withTimezone: true,
                useUtcDates: false
            });

            assertThat(dateUtils.parse("2024-08-05T14:58:35.7820000+02:00").getTime())
                .isEqualTo(sampleDate);
            assertThat(dateUtils.parse("1970-01-01T01:00:00.0000000+01:00").getTime())
                .isEqualTo(0);
        });

        it("can discard trailing microseconds", () => {

            const dateUtils = new DateUtil({
            });

            dateUtils.parse("2024-08-06T07:23:29.3218801");
            dateUtils.parse("2024-08-06T07:23:29.3218801Z");

            dateUtils.parse("2024-08-06T07:23:29.321880");
            dateUtils.parse("2024-08-06T07:23:29.321880Z");

            dateUtils.parse("2024-08-06T07:23:29.32188");
            dateUtils.parse("2024-08-06T07:23:29.32188Z");

            dateUtils.parse("2024-08-06T07:23:29.32188");
            dateUtils.parse("2024-08-06T07:23:29.32188Z");

            dateUtils.parse("2024-08-06T07:23:29.3218");
            dateUtils.parse("2024-08-06T07:23:29.3218Z");

            dateUtils.parse("2024-08-06T07:23:29.321");
            dateUtils.parse("2024-08-06T07:23:29.321Z");
        })
    });

    describe("without timezones", function () {

        it("should properly parse & format date (without UTC dates)", async function () {
            const dateUtil = new DateUtil({
                withTimezone: false
            });
            const date = moment("2018-10-15T09:46:28.306").toDate();
            const stringified = dateUtil.stringify(date);
            assert.strictEqual(stringified, "2018-10-15T09:46:28.3060000");

            const parsed = dateUtil.parse(stringified);
            assert.strictEqual(parsed.getHours(), date.getHours());
            assert.strictEqual(parsed.toISOString(), date.toISOString());
        });

        it("should properly format regular date using UTC dates", async function () {
            const dateUtil = new DateUtil({
                withTimezone: false,
                useUtcDates: true
            });
            const date = moment("2018-10-15T12:00:00.000").toDate();
            const stringified = dateUtil.stringify(date);

            const expected = new Date(2018, 9, 15, date.getHours() - LOCAL_TIMEZONE_OFFSET_HOURS, 0, 0, 0);
            const expectedStringified = moment(expected).format(momentDefaultDateFormat) + "Z";
            assert.strictEqual(stringified, expectedStringified);

            const parsed = dateUtil.parse(stringified);
            assert.strictEqual(parsed.getHours(), date.getHours());
            assert.strictEqual(parsed.toISOString(), date.toISOString());
        });

    });

    describe("with timezones", function () {

        it("should properly parse & format date (without UTC dates)", async function () {
            const dateUtil = new DateUtil({
                withTimezone: true
            });

            const hour6 = 12;
            const timezoneOffsetHours = 6;
            const date = moment.parseZone(`2018-10-15T${hour6}:00:00.0000000+06:00`).toDate();
            // preconditions check
            assert.strictEqual(
                date.getHours(), hour6 - timezoneOffsetHours + LOCAL_TIMEZONE_OFFSET_HOURS);

            const expectedHours = date.getHours();
            const expected = new Date(2018, 9, 15, expectedHours, 0, 0, 0);
            const expectedStringified = 
                moment(expected).format(momentDefaultDateFormat) + LOCAL_TIMEZONE_STRING;
            const stringified = dateUtil.stringify(date);
            assert.strictEqual(stringified, expectedStringified);

            const parsed = dateUtil.parse(stringified);
            assert.strictEqual(parsed.getHours(), date.getHours());
            assert.strictEqual(parsed.toISOString(), date.toISOString());
        });

        it("should properly format regular date using UTC dates", async function () {
            const dateUtil = new DateUtil({
                withTimezone: true,
                useUtcDates: true
            });

            const hour6 = 12;
            const timezoneOffsetHours = 6;
            const date = moment.parseZone(`2018-10-15T${hour6}:00:00.0000000+06:00`).toDate();
            // preconditions check
            assert.strictEqual(
                date.getHours(), hour6 - timezoneOffsetHours + LOCAL_TIMEZONE_OFFSET_HOURS);

            const expectedHours = date.getHours() - LOCAL_TIMEZONE_OFFSET_HOURS;
            const utcTimezoneString = "+00:00";
            const expected = new Date(2018, 9, 15, expectedHours, 0, 0, 0);
            const expectedStringified = 
                moment(expected).format(momentDefaultDateFormat) + utcTimezoneString;
            const stringified = dateUtil.stringify(date);
            assert.strictEqual(stringified, expectedStringified);

            const parsed = dateUtil.parse(stringified);
            assert.strictEqual(parsed.getHours(), date.getHours());
            assert.strictEqual(parsed.toISOString(), date.toISOString());
        });

    });

});

describe("[RDBC-236] Dates storage", function () {

    let store: IDocumentStore;

    describe("storing timezone info", function () {

        beforeEach(async function () {
            testContext.customizeStore = async store => {
                store.conventions.storeDatesWithTimezoneInfo = true;
                store.conventions.findCollectionNameForObjectLiteral = () => "tests";
            };
            store = await testContext.getDocumentStore();
        });

        afterEach(function () {
            testContext.customizeStore = null;
        });

        afterEach(async () =>
            await disposeTestDocumentStore(store));

        it("can store & load date", async () => {
            const hoursLocal = 13;
            const date = new Date(2018, 9, 12, hoursLocal, 10, 10, 0);

            {
                const session = store.openSession();
                await session.store({
                    start: date
                }, "date/1");
                await session.saveChanges();
            }
            
            {
                const cmd = new GetDocumentsCommand({
                    ids: [ "date/1" ],
                    start: 0,
                    pageSize: 1,
                    conventions: store.conventions
                });
                await store.getRequestExecutor().execute(cmd);
                assert.strictEqual(
                    cmd.result.results[0]["start"], "2018-10-12T13:10:10.0000000" + LOCAL_TIMEZONE_STRING);
            }

            {
                const session = store.openSession();
                const loaded = await session.load("date/1");
                const { start } = loaded as any;
                assert.strictEqual(start.getHours(), date.getHours());
                assert.strictEqual(start.toString(), date.toString());
            }
        });

    });

    describe("store dates as UTC", function () {

        beforeEach(async function () {
            testContext.customizeStore = async store => {
                store.conventions.storeDatesInUtc = true;
                store.conventions.findCollectionNameForObjectLiteral = () => "tests";
            };
            store = await testContext.getDocumentStore();
        });

        afterEach(function () {
            testContext.customizeStore = null;
        });

        afterEach(async () =>
            await disposeTestDocumentStore(store));

        it("can properly store & load date", async () => {
            const hoursLocal = 13;
            const date = new Date(2018, 9, 12, hoursLocal, 10, 10, 0);

            {
                const session = store.openSession();
                await session.store({
                    start: date
                }, "date/1");
                await session.saveChanges();
            }
            
            {
                const cmd = new GetDocumentsCommand({
                    ids: [ "date/1" ],
                    start: 0,
                    pageSize: 1,
                    conventions: store.conventions
                });
                await store.getRequestExecutor().execute(cmd);
                const hoursUtcString = StringUtil.leftPad(
                    (hoursLocal - LOCAL_TIMEZONE_OFFSET_HOURS).toString(), 2, "0");
                assert.strictEqual(
                    cmd.result.results[0]["start"], `2018-10-12T${hoursUtcString}:10:10.0000000Z`);
            }

            {
                const session = store.openSession();
                const loaded = await session.load("date/1");
                const { start } = loaded as any;
                assert.strictEqual(start.getHours(), date.getHours());
                assert.strictEqual(start.toString(), date.toString());
            }
        });

    });

    describe("store dates as UTC with timezone info", function () {

        beforeEach(async function () {
            testContext.customizeStore = async store => {
                store.conventions.storeDatesWithTimezoneInfo = true;
                store.conventions.storeDatesInUtc = true;
                store.conventions.findCollectionNameForObjectLiteral = () => "tests";
            };
            store = await testContext.getDocumentStore();
        });

        afterEach(function () {
            testContext.customizeStore = null;
        });

        afterEach(async () =>
            await disposeTestDocumentStore(store));

        it("can store & load date", async () => {
            const hoursLocal = 13;
            const date = new Date(2018, 9, 12, hoursLocal, 10, 10, 0);

            {
                const session = store.openSession();
                await session.store({
                    start: date
                }, "date/1");
                await session.saveChanges();
            }
            
            {
                const cmd = new GetDocumentsCommand({
                    ids: [ "date/1" ],
                    start: 0,
                    pageSize: 1,
                    conventions: store.conventions
                });
                await store.getRequestExecutor().execute(cmd);
                const hoursUtcString = StringUtil.leftPad(
                    (hoursLocal - LOCAL_TIMEZONE_OFFSET_HOURS).toString(), 2, "0");
                assert.strictEqual(
                    cmd.result.results[0]["start"], 
                    `2018-10-12T${hoursUtcString}:10:10.0000000+00:00`);
            }

            {
                const session = store.openSession();
                const loaded = await session.load("date/1");
                const { start } = loaded as any;
                assert.strictEqual(start.getHours(), date.getHours());
                assert.strictEqual(start.toString(), date.toString());
            }
        });

    });

});
