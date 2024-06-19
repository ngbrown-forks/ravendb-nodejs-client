import {
    AbstractJavaScriptIndexCreationTask,
    SpatialBounds,
    IDocumentStore,
    SpatialField
} from "../../../src/index.js";

import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

describe("BoundingBoxIndexTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("bounding box test", async () => {
        const polygon = "POLYGON ((0 0, 0 5, 1 5, 1 1, 5 1, 5 5, 6 5, 6 0, 0 0))";
        const rectangle1 = "2 2 4 4";
        const rectangle2 = "6 6 10 10";
        const rectangle3 = "0 0 6 6";

        await new BBoxIndex().execute(store);
        await new QuadTreeIndex().execute(store);

        {
            const session = store.openSession();
            const doc = new SpatialDoc();
            doc.shape = polygon;
            await session.store(doc);
            await session.saveChanges();
        }

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc).count();
            assert.strictEqual(result, 1);
        }

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc, BBoxIndex)
                .spatial("shape", x => x.intersects(rectangle1))
                .count();

            assert.strictEqual(result, 1);
        }

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc, BBoxIndex)
                .spatial("shape", x => x.intersects(rectangle2))
                .count();

            assert.strictEqual(result, 0);
        }

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc, BBoxIndex)
                .spatial("shape", x => x.disjoint(rectangle2))
                .count();

            assert.strictEqual(result, 1);
        }

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc, BBoxIndex)
                .spatial("shape", x => x.within(rectangle3))
                .count();

            assert.strictEqual(result, 1);
        }

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc, QuadTreeIndex)
                .spatial("shape", x => x.intersects(rectangle2))
                .count();

            assert.strictEqual(result, 0);
        }

        {
            const session = store.openSession();
            const result = await session.query(SpatialDoc, QuadTreeIndex)
                .spatial("shape", x => x.intersects(rectangle1))
                .count();

            assert.strictEqual(result, 0);
        }
    });

});

export class SpatialDoc {
    public id: string;
    public shape: string;
}

export class BBoxIndex extends AbstractJavaScriptIndexCreationTask<SpatialDoc, { shape: SpatialField }> {
    public constructor() {
        super();

        const { createSpatialField } = this.mapUtils();

        this.map(SpatialDoc, doc => {
            return {
                shape: createSpatialField(doc.shape)
            }
        });

        this.spatial("shape", x => x.cartesian().boundingBoxIndex());
    }
}

export class QuadTreeIndex extends AbstractJavaScriptIndexCreationTask<SpatialDoc, { shape: SpatialField }> {
    public constructor() {
        super();

        const { createSpatialField } = this.mapUtils();

        this.map(SpatialDoc, doc => {
            return {
                shape: createSpatialField(doc.shape)
            }
        });

        this.spatial("shape", x => x.cartesian().quadPrefixTreeIndex(6, new SpatialBounds(0, 0, 16, 16)));
    }
}
