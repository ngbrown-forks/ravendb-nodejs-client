import assert from "node:assert";
import "reflect-metadata";
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import { DocumentConventions, IDocumentStore, ITypesAwareObjectMapper, ObjectTypeDescriptor } from "../../src/index.js";
import { GetDocumentsCommand } from "../../src/Documents/Commands/GetDocumentsCommand.js";
import { TypeInfo } from "../../src/Mapping/ObjectMapper.js";
import { Transform, Expose, instanceToPlain, plainToInstance, Type } from "class-transformer";
import { assertThat } from "../Utils/AssertExtensions.js";

class ClassTransformer implements ITypesAwareObjectMapper {
    private _conventions: DocumentConventions;
    constructor(conventions: DocumentConventions) {
        this._conventions = conventions;
    }

    toObjectLiteral<TFrom extends object>(obj: TFrom, typeInfoCallback?: (typeInfo: TypeInfo) => void, knownTypes?: Map<string, ObjectTypeDescriptor>): object {
        typeInfoCallback?.({
            typeName: obj.constructor.name
        });

        return instanceToPlain(obj);
    }

    fromObjectLiteral<TResult extends object>(rawResult: object, typeInfo?: TypeInfo, knownTypes?: Map<string, ObjectTypeDescriptor>): TResult {
        const targetType = this._conventions.getJsTypeByDocumentType(typeInfo.typeName);
        if (targetType) {
            return plainToInstance(targetType as any, rawResult) as any;
        }

        return rawResult as any;
    }
}


describe("CustomSerializationTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        testContext.customizeStore = async store => {
            const conventions = store.conventions;

            conventions.objectMapper = new ClassTransformer(conventions);
            conventions.registerQueryValueConverter(Money, (fieldName, value, forRange, stringValue) => {
                stringValue(value.asString());
                return true;
            });
        };

        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can use custom serialization", async () => {
        {
            const session = store.openSession();
            const product1 = new Product();
            product1.name = "iPhone";
            product1.price = Money.forDollars(9999);

            const product2 = new Product();
            product2.name = "Camera";
            product2.price = Money.forEuro(150);

            const product3 = new Product();
            product3.name = "Bread";
            product3.price = Money.forDollars(2);

            await session.store(product1);
            await session.store(product2);
            await session.store(product3);
            await session.saveChanges();
        }

        // verify if value was properly serialized
        {
            const command = new GetDocumentsCommand({
                id: "products/1-A",
                conventions: store.conventions
            });
            await store.getRequestExecutor().execute(command);

            const productJson = command.result.results[0];
            assert.strictEqual(productJson.price, "9999 USD");
        }

        // verify if query properly serialize value
        {
            const session = store.openSession();
            const productsForTwoDollars = await session.query(Product)
                .whereEquals("price", Money.forDollars(2))
                .all();

            assert.strictEqual(productsForTwoDollars.length, 1);
            assert.strictEqual(productsForTwoDollars[0].name, "Bread");
            assert.ok(productsForTwoDollars[0].price instanceof Money);
        }
    });

    it("can serialize nested values", async () => {
        const shopper = new Shopper();

        const p1 = new Product();
        p1.price = Money.forDollars(20);
        p1.name = "Product1";

        const p2 = new Product();
        p2.price = Money.forEuro(30);
        p2.name = "Product";

        const homeAddress = new Address();
        homeAddress.city = "Torun";
        homeAddress.street = "Moniuszki";

        const address = new Address();
        address.street = "Kwiatowa";
        address.city = "Warsaw";

        shopper.birthday = new Date();
        shopper.bought = [p1, p2];
        shopper.salary = Money.forEuro(1_000_000);
        shopper.homeAddress = homeAddress;
        shopper.shipmentAddresses = [address];

        {
            const session = store.openSession();
            await session.store(shopper);
            assert.ok(shopper.id);
            await session.saveChanges();
        }

        // now load and verify
        {
            const session = store.openSession();
            const loaded = await session.load(shopper.id, Shopper);
            assertThat(loaded instanceof Shopper)
                .isTrue();

            assertThat(loaded.shipmentAddresses[0] instanceof Address)
                .isTrue();

            assertThat(loaded.salary instanceof Money)
                .isTrue();

        }
    })
});

class Shopper {
    id: string;
    firstName: string;
    lastName: string;
    @Type(() => Date)
    birthday: Date;

    @Type(() => Address)
    homeAddress: Address;
    @Type(() => Address)
    shipmentAddresses: Address[];

    @Type(() => Product)
    bought: Product[];

    @Transform(( { value })  => value.asString(), { toPlainOnly: true })
    @Transform(( { value })  => Money.fromString(value), { toClassOnly: true })
    salary: Money;
}

class Address {
    street: string;
    city: string;
}

export class Product {
    public name: string;

    @Type(() => Money)
    @Transform(( { value })  => value.asString(), { toPlainOnly: true })
    @Transform(( { value })  => Money.fromString(value), { toClassOnly: true })
    public price: Money;
}


export class Money {
    public readonly currency: string;
    public readonly amount: number;

    constructor(amount: number, currency: string) {
        this.currency = currency;
        this.amount = amount;
    }

    public static forDollars(amount: number) {
        return new Money(amount, "USD");
    }

    public static forEuro(amount: number) {
        return new Money(amount, "EUR");
    }

    public asString() {
        return this.amount + " " + this.currency;
    }

    public static fromString(value: string): Money {
        const [amount, currency] = value.split(" ", 2);
        return new Money(parseInt(amount), currency);
    }
}
