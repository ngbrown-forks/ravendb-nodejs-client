import { User } from "./Entities.js";
import { AbstractJavaScriptIndexCreationTask } from "../../src/Documents/Indexes/AbstractJavaScriptIndexCreationTask.js";
import { AbstractCsharpIndexCreationTask } from "../../src/Documents/Indexes.js";

export class UsersIndex extends AbstractJavaScriptIndexCreationTask<User, Pick<User, "name">> {
    public constructor() {
        super();
        this.map(User, u => {
            return {
                name: u.name
            }
        });
    }
}

export class UsersInvalidIndex extends AbstractCsharpIndexCreationTask {
    public constructor() {
        super();
        this.map = "from u in docs.Users select new { a = 5 / u.Age }";
    }
}

export class UsersIndexWithPascalCasedFields extends AbstractJavaScriptIndexCreationTask<any> {
    public constructor() {
        super();

        this.map(User, u => {
            return {
                Name: u.Name
            }
        });

        this.index("Name", "Search");
        this.store("Name", "Yes");
    }
}
