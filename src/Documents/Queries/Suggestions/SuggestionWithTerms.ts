import { SuggestionBase } from "./SuggestionBase.js";

export class SuggestionWithTerms extends SuggestionBase {
    public terms: string[];

    public constructor(field: string) {
        super(field);
    }
}
