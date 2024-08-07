import { DocumentConventions, ObjectTypeDescriptor } from "../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../Utils/TestUtil.js";
import { assertThat } from "../Utils/AssertExtensions.js";

describe("CustomEntityName", function () {

    const getChars = () => {
        const basicChars = [...new Array(31).keys()].map(x => {
            return String.fromCodePoint(x + 1);
        });

        const extraChars = [ "a", "-", "'", "\"", "\\", "\b", "\f", "\n", "\r", "\t" ];

        return [...basicChars, ...extraChars];
    };

    const getCharactersToTestWithSpecial = () => {
        const basicChars = getChars();
        const specialChars = [ "Ā", "Ȁ", "Ѐ", "Ԁ", "؀", "܀", "ऀ", "ਅ", "ଈ", "అ", "ഊ", "ข", "ဉ", "ᄍ", "ሎ", "ጇ", "ᐌ", "ᔎ", "ᘀ", "ᜩ", "ᢹ", "ᥤ", "ᨇ" ];
        return [...basicChars, ...specialChars];
    }

    async function testWhenCollectionAndIdContainSpecialChars(c: string) {
        testContext.customizeStore = async r => {
            r.conventions.findCollectionName = (constructorOrTypeChecker: ObjectTypeDescriptor) => {
                return "Test" + c + DocumentConventions.defaultGetCollectionName(constructorOrTypeChecker);
            }
        };

        const store = await testContext.getDocumentStore();
        try {

            if (c.charCodeAt(0) >= 14 && c.charCodeAt(0) <= 31) {
                return;
            }

            {
                const session = store.openSession();
                const car = new Car();
                car.manufacturer = "BMW";
                await session.store(car);

                const user = new User();
                user.carId = car.id;
                await session.store(user);
                await session.saveChanges();
            }

            {
                const session = store.openSession();
                const results = await session.query({
                    collection: store.conventions.findCollectionName(User),
                    documentType: User
                }).all();
                assertThat(results)
                    .hasSize(1);
            }
        } finally {
            testContext.customizeStore = null;
            await disposeTestDocumentStore(store);
        }
    }

    it("findCollectionName", async () => {
        for (const c of getCharactersToTestWithSpecial()) {
            await testWhenCollectionAndIdContainSpecialChars(c);
        }
    });
});

class User {
    public id: string;
    public carId: string;
}

class Car {
    public id: string;
    public manufacturer: string;
}
