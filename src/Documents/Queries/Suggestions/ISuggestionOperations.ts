import { SuggestionOptions } from "./SuggestionOptions.js";

export interface ISuggestionOperations<T> {
    withDisplayName(displayName: string): ISuggestionOperations<T>;
    withOptions(options: SuggestionOptions): ISuggestionOperations<T>;
}
