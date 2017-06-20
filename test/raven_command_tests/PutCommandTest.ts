/// <reference path="../../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../../node_modules/@types/chai/index.d.ts" />

import {expect} from 'chai';
import {PutDocumentCommand} from "../../src/Database/Commands/PutDocumentCommand";
import {RequestsExecutor} from "../../src/Http/Request/RequestsExecutor";
import {GetDocumentCommand} from "../../src/Database/Commands/GetDocumentCommand";
import {IRavenResponse} from "../../src/Database/RavenCommandResponse";
import {IRavenObject} from "../../src/Database/IRavenObject";

describe('Put command tests', () => {
  let requestsExecutor: RequestsExecutor;

  beforeEach(function(): void {
    ({requestsExecutor} = this.currentTest as IRavenObject);
  });

  it('should put successfully', async() => requestsExecutor
    .execute(new PutDocumentCommand('testing/1', {'name': 'test', '@metadata': {}}))
    .then(() => requestsExecutor.execute(new GetDocumentCommand('testing/1')))
    .then((result: IRavenResponse) => expect(result.Results[0]['@metadata']['@id']).to.equals('testing/1'))
  );

  it('should fail with invalid json', async() => expect(
      requestsExecutor.execute(new PutDocumentCommand('testing/2', <any>'document'))
    ).to.be.rejected
  );
});
