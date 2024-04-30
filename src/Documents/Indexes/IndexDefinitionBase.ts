import { IndexPriority, IndexState } from "./Enums.js";


export abstract class IndexDefinitionBase {
    public name: string;
    public priority: IndexPriority;
    public state: IndexState;

}
