import { HighlightingOptions } from "./HighlightingOptions.js";

export interface HighlightingParameters extends HighlightingOptions {
    fieldName: string; 
    fragmentLength: number;
    fragmentCount: number;
}
