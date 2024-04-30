import { DocumentConventions } from "../Documents/Conventions/DocumentConventions.js";

export interface IBroadcast {
    prepareToBroadcast(conventions: DocumentConventions): IBroadcast;
}