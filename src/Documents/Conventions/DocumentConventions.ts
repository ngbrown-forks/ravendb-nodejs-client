import {IDocument, DocumentKey} from '../IDocument';
import {InvalidOperationException} from "../../Database/DatabaseExceptions";
import * as pluralize from 'pluralize';
import {IMetadata} from "../../Database/Metadata";
import {SortOption, SortOptions} from "../../Database/Indexes/SortOption";
import {StringUtil} from "../../Utility/StringUtil";

export class DocumentConventions<T extends IDocument> {
  readonly maxNumberOfRequestPerSession: number = 30;
  readonly maxIdsToCatch: number = 32;
  readonly timeout: number = 30;
  readonly defaultUseOptimisticConcurrency:boolean = false;
  readonly maxLengthOfQueryUsingGetUrl = 1024 + 512;
  readonly identityPartsSeparator = "/";
  private _systemDatabase: string = "system";
  private _documentEntityClass: { new(): T; };

  constructor(documentEntityClass: { new(): T; }) {
    this._documentEntityClass = documentEntityClass;
  }

  public get documentEntity(): string {
    return this._documentEntityClass.name;
  }

  public get documentEntityName(): string {
     return this.documentEntity.toLowerCase();
  }

  public get documentsCollectionName(): string {
    return pluralize(this.documentEntityName);
  }

  public get documentIdPropertyName(): string {
    return '_id';
  }

  public get systemDatabase(): string {
    return this._systemDatabase;
  }

  public trySetIdOnEntity(entity: T, key: DocumentKey): T {
    const idProperty = this.documentIdPropertyName;

    if (!entity.hasOwnProperty(idProperty)) {
      throw new InvalidOperationException("Invalid entity provided. It should implement IDocument interface");
    }

    entity[idProperty] = key;
    return entity;
  }

  public tryGetIdFromInstance(entity?: T): DocumentKey {
    const idProperty = this.documentIdPropertyName;

    if (!entity) {
      throw new InvalidOperationException("Empty entity provided.");
    }

    if (!entity.hasOwnProperty(idProperty)) {
      throw new InvalidOperationException("Invalid entity provided. It should implement IDocument interface");
    }

    return entity[idProperty];
  }

  public buildDefaultMetadata(entity?: T): IMetadata {
    if (entity) {
      return {
        '@collection': this.documentsCollectionName,
        'Raven-Node-Type': this.documentEntityName
      }
    }

    return {};
  }

  public tryGetTypeFromMetadata(metadata: IMetadata): string | null {
    if ('Raven-Node-Type' in metadata) {
      return metadata['Raven-Node-Type'];
    }

    return null;
  }

  public usesRangeType(queryFilterValue: any): boolean {
    return 'number' === (typeof queryFilterValue);
  }

  public rangedFieldName(fieldName: string, queryFilterValue: any): string {
    if ('number' === (typeof queryFilterValue)) {
      return StringUtil.format(
        '{1}_{0}_Range', fieldName,
        Number.isInteger(queryFilterValue) ? 'L': 'D'
      );
    }

    return fieldName;
  }

  public getDefaultSortOption(queryFilterValue: any): SortOption | null {
    switch (typeof queryFilterValue) {
      case 'number':
        return SortOptions.Numeric;
      case 'string':
        return SortOptions.Str;
      default:
        return SortOptions.None;
    }
  }
}