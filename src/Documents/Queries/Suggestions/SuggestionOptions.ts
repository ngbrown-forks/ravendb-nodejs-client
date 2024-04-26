import { StringDistanceTypes } from "./StringDistanceTypes.js";
import { SuggestionSortMode } from "./SuggestionSortMode.js";

export interface SuggestionOptions {
    pageSize: number;
    distance: StringDistanceTypes;
    accuracy: number;
    sortMode: SuggestionSortMode;
}
