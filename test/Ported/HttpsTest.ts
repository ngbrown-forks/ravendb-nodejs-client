import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import {
    CertificateRawData,
    CreateClientCertificateOperation,
    DatabaseAccess,
    DeleteCertificateOperation,
    DocumentStore,
    GetCertificateOperation,
    GetCertificatesOperation,
    ReplaceClusterCertificateOperation,
    IDocumentStore,
    PutClientCertificateOperation,
    EditClientCertificateOperation,
    EditClientCertificateParameters,
    GetCertificateMetadataOperation,
    GetCertificatesMetadataOperation
} from "../../src/index.js";
import { assertThat, assertThrows } from "../Utils/AssertExtensions.js";
import { Parse } from "unzipper";
import { bufferToReadable, readToBuffer, readToEnd } from "../../src/Utility/StreamUtil.js";

describe("HttpsTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getSecuredDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can connect with certificate", async () => {
        assert.strictEqual(store.urls[0].slice(0, 5), "https");
        const session = store.openSession();
        await session.store({ lastName: "Snow" }, "users/1");
        await session.saveChanges();
    });

    it("can replace certificate", async () => {
        // we are sending some garbage as we don't want to modify shared server certificate!

        await assertThrows(async () => {
            const bytes = Buffer.from([1, 2, 3, 4])
            await store.maintenance.server.send(new ReplaceClusterCertificateOperation(bytes, true));
        }, err => {
            assertThat(err.message)
                .contains("Unable to load the provided certificate");
        })
    });

    it("can crud certificates", async function () {
        this.timeout(60_000);

        let cert1Thumbprint: string;
        let cert2Thumbprint: string;

        try {
            // create cert1
            const cert1 = await store.maintenance.server.send(
                new CreateClientCertificateOperation("cert1", {}, "Operator"));
            assertThat(cert1)
                .isNotNull();
            assertThat(cert1.rawData)
                .isNotNull();
            assertThat(cert1.rawData.length)
                .isGreaterThan(4096);

            const zipMagic = "PK";

            assertThat(cert1.rawData.readUInt8(0))
                .isEqualTo(zipMagic.charCodeAt(0));
            assertThat(cert1.rawData.readUInt8(1))
                .isEqualTo(zipMagic.charCodeAt(1));

            const clearance = {
                [store.database]: "ReadWrite"
            } as Record<string, DatabaseAccess>;

            const cert2 = await store.maintenance.server.send(
                new CreateClientCertificateOperation("cert2", clearance, "ValidUser"));

            // create cert2

            assertThat(cert2)
                .isNotNull();
            assertThat(cert2.rawData)
                .isNotNull();

            // list certs

            let certificateDefinitions = await store.maintenance.server.send(
                new GetCertificatesOperation(0, 20));
            assertThat(certificateDefinitions.length)
                .isGreaterThan(1);

            assertThat(certificateDefinitions.find(x => x.name === "cert1"))
                .isNotNull();
            assertThat(certificateDefinitions.find(x => x.name === "cert2"))
                .isNotNull();

            cert1Thumbprint = certificateDefinitions.find(x => x.name === "cert1").thumbprint;
            cert2Thumbprint = certificateDefinitions.find(x => x.name === "cert2").thumbprint;

            // delete cert1
            await store.maintenance.server.send(new DeleteCertificateOperation(cert1Thumbprint));

            // get cert by thumbprint
            const definition = await store.maintenance.server.send(new GetCertificateOperation(cert1Thumbprint));
            assertThat(definition)
                .isNull();

            const definition2 = await store.maintenance.server.send(new GetCertificateOperation(cert2Thumbprint));
            assertThat(definition2)
                .isNotNull();
            assertThat(definition2.name)
                .isEqualTo("cert2");

            // list again
            certificateDefinitions = await store.maintenance.server.send(
                new GetCertificatesOperation(0, 20));

            assertThat(certificateDefinitions.find(x => x.name === "cert1"))
                .isNull();
            assertThat(certificateDefinitions.find(x => x.name === "cert2"))
                .isNotNull();

            // extract public key from generated private key
            const publicKey = await extractCertificate(cert1);

            // put cert1 again, using put certificate command
            const putOperation = new PutClientCertificateOperation("cert3", publicKey, {}, "ClusterAdmin");
            await store.maintenance.server.send(putOperation);

            certificateDefinitions = await store.maintenance.server.send(new GetCertificatesOperation(0, 20));

            assertThat(certificateDefinitions.find(x => x.name === "cert1"))
                .isNull();
            assertThat(certificateDefinitions.find(x => x.name === "cert2"))
                .isNotNull();
            assertThat(certificateDefinitions.find(x => x.name === "cert2").notAfter instanceof Date)
                .isTrue();
            assertThat(certificateDefinitions.find(x => x.name === "cert2").notBefore instanceof Date)
                .isTrue();
            assertThat(certificateDefinitions.find(x => x.name === "cert3"))
                .isNotNull();

            // and try to use edit
            const parameters: EditClientCertificateParameters = {
                name: "cert3-newName",
                thumbprint: cert1Thumbprint,
                permissions: {},
                clearance: "ValidUser"
            };

            await store.maintenance.server.send(new EditClientCertificateOperation(parameters));

            certificateDefinitions = await store.maintenance.server.send(new GetCertificatesOperation(0, 20));

            const names = certificateDefinitions.map(x => x.name);
            assertThat(names)
                .contains("cert3-newName");
            assertThat(names.includes("cert3"))
                .isFalse();

            const certificateMetadata = await store.maintenance.server.send(new GetCertificateMetadataOperation(cert1Thumbprint));

            assertThat(certificateMetadata)
                .isNotNull();
            assertThat(certificateMetadata.securityClearance)
                .isEqualTo("ValidUser");
            assertThat(certificateMetadata.notAfter instanceof Date)
                .isTrue();
            assertThat(certificateMetadata.notBefore instanceof Date)
                .isTrue();

            const certificatesMetadata = await store.maintenance.server.send(
                new GetCertificatesMetadataOperation(certificateMetadata.name));

            assertThat(certificatesMetadata)
                .hasSize(1);
            assertThat(certificatesMetadata[0])
                .isNotNull();
            assertThat(certificatesMetadata[0].securityClearance)
                .isEqualTo("ValidUser");
        } finally {
            // try to clean up
            if (cert1Thumbprint) {
                await store.maintenance.server.send(new DeleteCertificateOperation(cert1Thumbprint));
            }
            if (cert2Thumbprint) {
                await store.maintenance.server.send(new DeleteCertificateOperation(cert2Thumbprint));
            }
        }
    });

    it("shouldThrowAuthorizationExceptionWhenNotAuthorized", async () => {
        const certificateRawData = await store.maintenance.server.send(
            new CreateClientCertificateOperation("users-auth-test", { "db1": "ReadWrite" }, "ValidUser"));

        const pfx = await extractPfx(certificateRawData);

        let storeWithOutCert: DocumentStore;
        try {
            storeWithOutCert = new DocumentStore(store.urls, store.database, {
                certificate: pfx,
                type: "pfx",
                ca: store.authOptions.ca
            });

            storeWithOutCert.initialize();

            await assertThrows(async () => {
                const session = storeWithOutCert.openSession();
                await session.load("users/1");
            }, err => {
                assert.strictEqual(err.name, "AuthorizationException");
                assertThat(err.message)
                    .contains("Forbidden access to ");
            });
        } finally {
            storeWithOutCert.dispose();
        }
    });

    it("canUseServerGeneratedCertificate", async () => {
        const certificateRawData = await store.maintenance.server.send(
            new CreateClientCertificateOperation("users-auth-test", { /* empty */ }, "Operator"));

        const pfx = await extractPfx(certificateRawData);

        let securedStore: DocumentStore;
        try {
            securedStore = new DocumentStore(store.urls, store.database, {
                certificate: pfx,
                type: "pfx",
                ca: store.authOptions.ca
            });

            securedStore.initialize();

            {
                const session = securedStore.openSession();
                await session.load("users/1");
            }
        } finally {
            securedStore.dispose();
        }
    });

    it("throws AuthorizationException when connecting to secured server w/o client certificate", async () => {
        const storeWoCertificate = new DocumentStore(store.urls, store.database);
        try {
            storeWoCertificate.initialize();

            await assertThrows(async () => {
                const session = storeWoCertificate.openSession();
                await session.load("users/1");
            }, err => {
                assertThat(err.name)
                    .isEqualTo("AuthorizationException");
                assertThat(err.message)
                    .contains("server requires client certificate");
            })
        } finally {
            storeWoCertificate.dispose();
        }
    });
});

async function extractCertificate(certificateRawData: CertificateRawData) {
    const stream = bufferToReadable(certificateRawData.rawData)
        .pipe(Parse( { forceStream: true }));

    let cert = "";

    for await (const entry of stream) {
        if (entry.path.endsWith(".crt")) {
            const entryText = await readToEnd(entry);
            const lines = entryText.split(/\r?\n/);
            cert = lines.slice(1, - 2).join("\r\n");
            break;
        } else {
            entry.autodrain();
        }
    }

    stream.destroy();

    return cert;
}

async function extractPfx(certificateRawData: CertificateRawData) {
    const stream = bufferToReadable(certificateRawData.rawData)
        .pipe(Parse( { forceStream: true }));

    for await (const entry of stream) {
        if (entry.path.endsWith(".pfx")) {
            return await readToBuffer(entry);
        } else {
            entry.autodrain();
        }
    }

    return null;
}
