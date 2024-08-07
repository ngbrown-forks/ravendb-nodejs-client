import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    AbstractJavaScriptIndexCreationTask, DateUtil,
    IDocumentStore,
    RangeBuilder,
} from "../../../src/index.js";
import { addDays, setYear } from "date-fns";

class ItemsOrders_All extends AbstractJavaScriptIndexCreationTask<ItemsOrder, Pick<ItemsOrder, "at" | "items">> {
    public constructor() {
        super();
        this.map(ItemsOrder, order => {
            return {
                at: order.at,
                items: order.items
            }
        });
    }
}

class Orders_All extends AbstractJavaScriptIndexCreationTask<Order> {
    public constructor() {
        super();
        this.map(Order, order => {
            return {
                currency: order.currency,
                product: order.product,
                total: order.total,
                quantity: order.quantity,
                region: order.region,
                at: order.at,
                tax: order.tax
            }
        });
    }
}

type Currency = "EUR" | "PLN" | "NIS";

class Order {
    public currency: Currency;
    public product: string;
    public total: number;
    public region: number;
    public quantity: number;
    public at: Date;
    public tax: number;
}

class ItemsOrder {
    public items: string[];
    public at: Date;
}

describe("AggregationTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        testContext.customizeStore = async store => {
            store.conventions.storeDatesInUtc = true;
        };
        store = await testContext.getDocumentStore();
    });

    afterEach(async () => {
        testContext.customizeStore = null;
        await disposeTestDocumentStore(store);
    });

    describe("with Orders/All index", () => {

        let ordersAllIndex: Orders_All;

        beforeEach(async () => {
            ordersAllIndex = new Orders_All();
            await ordersAllIndex.execute(store);
        });

        it("can correctly aggregate - double", async () => {
            {
                const session = store.openSession();
                const obj = new Order();
                obj.currency = "EUR";
                obj.product = "Milk";
                obj.total = 1.1;
                obj.region = 1;

                const obj2 = new Order();
                obj2.currency = "EUR";
                obj2.product = "Milk";
                obj2.total = 1;
                obj2.region = 1;

                await session.store(obj);
                await session.store(obj2);
                await session.saveChanges();
            }

            await testContext.waitForIndexing(store);

            {
                const session = store.openSession();
                const result = await session.query({ index: Orders_All })
                    .aggregateBy(x => x.byField("region")
                        .maxOn("total")
                        .minOn("total"))
                    .execute();

                const facetResult = result["region"];
                assert.strictEqual(facetResult.values[0].count, 2);
                assert.strictEqual(facetResult.values[0].min, 1);
                assert.strictEqual(facetResult.values[0].max, 1.1);
            }
        });

        it("can correctly aggregate - multiple items", async () => {
            {
                const session = store.openSession();
                const obj = new Order();
                obj.currency = "EUR";
                obj.product = "Milk";
                obj.total = 3;

                const obj2 = new Order();
                obj2.currency = "NIS";
                obj2.product = "Milk";
                obj2.total = 9;

                const obj3 = new Order();
                obj3.currency = "EUR";
                obj3.product = "iPhone";
                obj3.total = 3333;

                await session.store(obj);
                await session.store(obj2);
                await session.store(obj3);
                await session.saveChanges();
            }

            await testContext.waitForIndexing(store);

            {
                const session = store.openSession();
                const r = await session.query({ index: Orders_All })
                    .aggregateBy(x => x.byField("product").sumOn("total"))
                    .andAggregateBy(x => x.byField("currency").sumOn("total"))
                    .execute();

                let facetResult = r["product"];
                assert.strictEqual(facetResult.values.length, 2);
                assert.strictEqual(facetResult.values.find(x => x.range === "milk").sum, 12);
                assert.strictEqual(facetResult.values.find(x => x.range === "iphone").sum, 3333);

                facetResult = r["currency"];
                assert.strictEqual(facetResult.values.length, 2);
                assert.strictEqual(facetResult.values.find(x => x.range === "eur").sum, 3336);
                assert.strictEqual(facetResult.values.find(x => x.range === "nis").sum, 9);
            }
        });

        it("can correctly aggregate - multiple aggregations", async () => {
            {
                const session = store.openSession();
                const obj = new Order();
                obj.currency = "EUR";
                obj.product = "Milk";
                obj.total = 3;

                const obj2 = new Order();
                obj2.currency = "NIS";
                obj2.product = "Milk";
                obj2.total = 9;

                const obj3 = new Order();
                obj3.currency = "EUR";
                obj3.product = "iPhone";
                obj3.total = 3333;

                await session.store(obj);
                await session.store(obj2);
                await session.store(obj3);
                await session.saveChanges();
            }

            await testContext.waitForIndexing(store);

            {
                const session = store.openSession();
                const r = await session.query({ index: Orders_All })
                    .aggregateBy(x => x.byField("product").maxOn("total").minOn("total"))
                    .execute();

                const facetResult = r["product"];
                assert.strictEqual(facetResult.values.length, 2);
                assert.strictEqual(facetResult.values.find(x => x.range === "milk").max, 9);
                assert.strictEqual(facetResult.values.find(x => x.range === "milk").min, 3);
                assert.strictEqual(facetResult.values.find(x => x.range === "iphone").max, 3333);
                assert.strictEqual(facetResult.values.find(x => x.range === "iphone").min, 3333);
            }
        });

        it("can correctly aggregate - display name", async () => {
            {
                const session = store.openSession();
                const obj = new Order();
                obj.currency = "EUR";
                obj.product = "Milk";
                obj.total = 3;

                const obj2 = new Order();
                obj2.currency = "NIS";
                obj2.product = "Milk";
                obj2.total = 9;

                const obj3 = new Order();
                obj3.currency = "EUR";
                obj3.product = "iPhone";
                obj3.total = 3333;

                await session.store(obj);
                await session.store(obj2);
                await session.store(obj3);
                await session.saveChanges();
            }

            await testContext.waitForIndexing(store);

            {
                const session = store.openSession();
                const r = await session.query({ index: Orders_All })
                    .aggregateBy(x => x.byField("product")
                        .withDisplayName("productMax").maxOn("total"))
                    .andAggregateBy(x => x.byField("product").withDisplayName("productMin"))
                    .execute();

                assert.strictEqual(Object.keys(r).length, 2);
                assert.ok(r["productMax"]);
                assert.ok(r["productMin"]);
                assert.strictEqual(r["productMax"].values[0].max, 3333);
                assert.strictEqual(r["productMin"].values[1].count, 2);
            }

        });

        it("can correctly aggregate - ranges", async () => {
            {
                const session = store.openSession();
                const obj = new Order();
                obj.currency = "EUR";
                obj.product = "Milk";
                obj.total = 3;

                const obj2 = new Order();
                obj2.currency = "NIS";
                obj2.product = "Milk";
                obj2.total = 9;

                const obj3 = new Order();
                obj3.currency = "EUR";
                obj3.product = "iPhone";
                obj3.total = 3333;

                await session.store(obj);
                await session.store(obj2);
                await session.store(obj3);
                await session.saveChanges();
            }

            await testContext.waitForIndexing(store);

            {
                const session = store.openSession();

                const range = RangeBuilder.forPath("total");

                const r = await session.query({ index: Orders_All })
                    .aggregateBy(f => f.byField("product").sumOn("total"))
                    .andAggregateBy(f => f.byRanges(
                        range.isLessThan(100),
                        range.isGreaterThanOrEqualTo(100).isLessThan(500),
                        range.isGreaterThanOrEqualTo(500).isLessThan(1500),
                        range.isGreaterThanOrEqualTo(1500))
                        .sumOn("total"))
                    .execute();

                let facetResult = r["product"];
                assert.strictEqual(Object.keys(r).length, 2);
                assert.strictEqual(facetResult.values.find(x => x.range === "milk").sum, 12);
                assert.strictEqual(facetResult.values.find(x => x.range === "iphone").sum, 3333);

                facetResult = r["total"];
                assert.strictEqual(facetResult.values.length, 4);

                assert.strictEqual(
                    facetResult.values.find(x => x.range === "total < 100").sum, 12);
                assert.strictEqual(
                    facetResult.values.find(x => x.range === "total >= 1500").sum, 3333);
            }

        });

    });

    it("can correctly aggregate - with range counts", async () => {

        const idx = new ItemsOrders_All();
        await idx.execute(store);

        const now = new Date();
        {
            const session = store.openSession();
            const item1 = new ItemsOrder();
            item1.items = ["first", "second"];
            item1.at = now;

            const item2 = new ItemsOrder();
            item2.items = ["first", "second"];
            item2.at = addDays(now, -1);

            const item3 = new ItemsOrder();
            item3.items = ["first"];
            item3.at = now;

            const item4 = new ItemsOrder();
            item4.items = ["first"];
            item4.at = now;

            await session.store(item1);
            await session.store(item2);
            await session.store(item3);
            await session.store(item4);
            await session.saveChanges();
        }

        const oldDate = setYear(now, 1980);

        const minValue = oldDate;
        const end0 = addDays(now, -2);
        const end1 = addDays(now, -1);
        const end2 = now;

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            const builder = RangeBuilder.forPath("at");
            const r = await session.query({ index: ItemsOrders_All })
                .whereGreaterThanOrEqual("at", end0)
                .aggregateBy(f => f.byRanges(
                    builder.isGreaterThanOrEqualTo(minValue),
                    builder.isGreaterThanOrEqualTo(end0).isLessThan(end1),
                    builder.isGreaterThanOrEqualTo(end1).isLessThan(end2)
                ))
                .execute();

            const [facet1, facet2, facet3] = r["at"].values;
            assert.strictEqual(facet1.count, 4);
            assert.strictEqual(facet2.count, 0);
            assert.strictEqual(facet3.count, 1);
        }
    });
});
