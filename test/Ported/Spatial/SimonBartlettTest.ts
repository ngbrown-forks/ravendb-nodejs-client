import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    AbstractJavaScriptIndexCreationTask,
    IDocumentStore,
    SpatialOptions,
    SpatialField
} from "../../../src/index.js";

describe("SimonBartlettTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("lineStringsShouldIntersect", async () => {

        await store.executeIndex(new GeoIndex());

        {
            const session = store.openSession();
            const geoDocument = new GeoDocument();
            geoDocument.WKT = "LINESTRING (0 0, 1 1, 2 1)";
            await session.store(geoDocument);
            await session.saveChanges();
        }

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            let count = await session.query({
                indexName: GeoIndex.name
            })
                .spatial("WKT", f => f.relatesToShape("LINESTRING (1 0, 1 1, 1 2)", "Intersects"))
                .waitForNonStaleResults()
                .count();

            assert.strictEqual(count, 1);

            count = await session.query({ index: GeoIndex })
                .relatesToShape("WKT", "LINESTRING (1 0, 1 1, 1 2)", "Intersects")
                .waitForNonStaleResults()
                .count();

            assert.strictEqual(count, 1);
        }

    });

    it("circlesShouldNotIntersect", async () => {
        await store.executeIndex(new GeoIndex());

        {
            const session = store.openSession();
            // 110km is approximately 1 degree
            const geoDocument = new GeoDocument();
            geoDocument.WKT = "CIRCLE(0.000000 0.000000 d=110)";
            await session.store(geoDocument);
            await session.saveChanges();
        }

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            // Should not intersect, as there is 1 Degree between the two shapes
            let count = await session.query({
                index: GeoIndex
            })
                .spatial("WKT", f => f.relatesToShape("CIRCLE(0.000000 3.000000 d=110)", "Intersects"))
                .waitForNonStaleResults()
                .count();

            assert.strictEqual(count, 0);

            count = await session.query({ index: GeoIndex })
                .relatesToShape("WKT", "CIRCLE(0.000000 3.000000 d=110)", "Intersects")
                .waitForNonStaleResults()
                .count();

            assert.strictEqual(count, 0);
        }
    });

});

class GeoDocument {
    public WKT: string;
}

class GeoIndex extends AbstractJavaScriptIndexCreationTask<GeoDocument, { WKT: SpatialField }> {
    public constructor() {
        super();

        const { createSpatialField } = this.mapUtils();

        this.map(GeoDocument, doc => {
            return {
                WKT: createSpatialField(doc.WKT)
            }
        });

        const spatialOptions = new SpatialOptions();
        spatialOptions.strategy = "GeohashPrefixTree";

        this.spatialOptionsStrings["WKT"] = spatialOptions;
    }
}
