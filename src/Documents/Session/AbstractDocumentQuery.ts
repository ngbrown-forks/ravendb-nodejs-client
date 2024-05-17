import { Lazy } from "../Lazy.js";
import { QueryOperation } from "./Operations/QueryOperation.js";
import { GroupByCountToken } from "./Tokens/GroupByCountToken.js";
import { GroupByToken } from "./Tokens/GroupByToken.js";
import { HighlightingToken } from "./Tokens/HighlightingToken.js";
import { FieldsToFetchToken } from "./Tokens/FieldsToFetchToken.js";
import { DeclareToken } from "./Tokens/DeclareToken.js";
import { LoadToken } from "./Tokens/LoadToken.js";
import { FromToken } from "./Tokens/FromToken.js";
import { DistinctToken } from "./Tokens/DistinctToken.js";
import { InMemoryDocumentSessionOperations } from "./InMemoryDocumentSessionOperations.js";
import { QueryStatistics } from "./QueryStatistics.js";
import { IDocumentSession } from "./IDocumentSession.js";
import { throwError } from "../../Exceptions/index.js";
import { QueryOperator } from "../Queries/QueryOperator.js";
import { IndexQuery } from "../Queries/IndexQuery.js";
import { IAbstractDocumentQuery } from "./IAbstractDocumentQuery.js";
import { GroupBy } from "../Queries/GroupBy.js";
import { GroupByKeyToken } from "../Session/Tokens/GroupByKeyToken.js";
import { GroupBySumToken } from "../Session/Tokens/GroupBySumToken.js";
import { ExplanationToken } from "../Session/Tokens/ExplanationToken.js";
import { TimingsToken } from "../Session/Tokens/TimingsToken.js";
import { TrueToken } from "../Session/Tokens/TrueToken.js";
import { WhereToken, WhereOptions } from "../Session/Tokens/WhereToken.js";
import { QueryFieldUtil } from "../Queries/QueryFieldUtil.js";
import { QueryToken } from "./Tokens/QueryToken.js";
import { CloseSubclauseToken } from "./Tokens/CloseSubclauseToken.js";
import { OpenSubclauseToken } from "./Tokens/OpenSubclauseToken.js";
import { NegateToken } from "./Tokens/NegateToken.js";
import { WhereParams } from "./WhereParams.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { DateUtil } from "../../Utility/DateUtil.js";
import { MethodCall } from "./MethodCall.js";
import { QueryOperatorToken } from "./Tokens/QueryOperatorToken.js";
import { OrderByToken } from "./Tokens/OrderByToken.js";
import { FacetToken } from "./Tokens/FacetToken.js";
import { CounterIncludesToken } from "./Tokens/CounterIncludesToken.js";
import { QueryResult } from "../Queries/QueryResult.js";
import { DocumentType } from "../DocumentAbstractions.js";
import { QueryEventsEmitter } from "./QueryEvents.js";
import { EventEmitter } from "node:events";
import { StringUtil } from "../../Utility/StringUtil.js";
import { IntersectMarkerToken } from "./Tokens/IntersectMarkerToken.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { CONSTANTS, TIME_SERIES } from "../../Constants.js";
import { WhereOperator } from "./Tokens/WhereOperator.js";
import { OrderingType } from "./OrderingType.js";
import { SearchOperator } from "../Queries/SearchOperator.js";
import { DocumentQueryHelper } from "./DocumentQueryHelper.js";
import { SpatialUnits, SpatialRelation } from "../Indexes/Spatial.js";
import { ShapeToken } from "./Tokens/ShapeToken.js";
import { DynamicSpatialField } from "../Queries/Spatial/DynamicSpatialField.js";
import { SpatialCriteria } from "../Queries/Spatial/SpatialCriteria.js";
import { SessionBeforeQueryEventArgs } from "./SessionEvents.js";
import { CmpXchg } from "./CmpXchg.js";
import { ValueCallback } from "../../Types/Callbacks.js";
import { DocumentQueryCustomization } from "./DocumentQueryCustomization.js";
import { FacetBase } from "../Queries/Facets/FacetBase.js";
import { MoreLikeThisScope } from "../Queries/MoreLikeThis/MoreLikeThisScope.js";
import { MoreLikeThisToken } from "./Tokens/MoreLikeThisToken.js";
import { LazyQueryOperation } from "../Session/Operations/Lazy/LazyQueryOperation.js";
import { DocumentSession } from "./DocumentSession.js";
import { SuggestionBase } from "../Queries/Suggestions/SuggestionBase.js";
import { SuggestionOptions } from "../Queries/Suggestions/SuggestionOptions.js";
import { SuggestToken } from "./Tokens/SuggestToken.js";
import { SuggestionWithTerm } from "../Queries/Suggestions/SuggestionWithTerm.js";
import { SuggestionWithTerms } from "../Queries/Suggestions/SuggestionWithTerms.js";
import { QueryData } from "../Queries/QueryData.js";
import { QueryTimings } from "../Queries/Timings/QueryTimings.js";
import { Explanations } from "../Queries/Explanation/Explanations.js";
import { Highlightings } from "../Queries/Highlighting/Hightlightings.js";
import {
    extractHighlightingOptionsFromParameters } from "../Queries/Highlighting/HighlightingOptions.js";
import { HighlightingParameters } from "../Queries/Highlighting/HighlightingParameters.js";
import { QueryHighlightings } from "../Queries/Highlighting/QueryHighlightings.js";
import { ExplanationOptions } from "../Queries/Explanation/ExplanationOptions.js";
import { CountersByDocId } from "./CounterInternalTypes.js";
import { IncludeBuilderBase } from "./Loaders/IncludeBuilderBase.js";
import { IncludesUtil } from "./IncludesUtil.js";
import { TimeSeriesIncludesToken } from "./Tokens/TimeSeriesIncludesToken.js";
import { CompareExchangeValueIncludesToken } from "./Tokens/CompareExchangeValueIncludesToken.js";
import { ITimeSeriesQueryBuilder } from "../Queries/TimeSeries/ITimeSeriesQueryBuilder.js";
import { TimeSeriesQueryBuilder } from "../Queries/TimeSeries/TimeSeriesQueryBuilder.js";
import { StringBuilder } from "../../Utility/StringBuilder.js";
import { ProjectionBehavior } from "../Queries/ProjectionBehavior.js";
import { AbstractTimeSeriesRange } from "../Operations/TimeSeries/AbstractTimeSeriesRange.js";
import { IAbstractDocumentQueryImpl } from "./IAbstractDocumentQueryImpl.js";
import { RevisionIncludesToken } from "./Tokens/RevisionIncludesToken.js";
import { IDisposable } from "../../Types/Contracts.js";
import { EOL } from "../../Utility/OsUtil.js";

/**
 * A query against a Raven index
 */
export abstract class AbstractDocumentQuery<T extends object, TSelf extends AbstractDocumentQuery<T, TSelf>>
    extends EventEmitter
    implements QueryEventsEmitter, IAbstractDocumentQuery<T>, IAbstractDocumentQueryImpl<T> {

    protected _clazz: DocumentType<T>;

    private _aliasToGroupByFieldName: { [key: string]: string } = {};

    protected _defaultOperator: QueryOperator = "AND";

    protected _rootTypes: Set<DocumentType> = new Set<DocumentType>();

    /**
     * Whether to negate the next operation
     */
    protected _negate: boolean;

    /**
     * Whether to negate the next operation in Filter
     */
    protected _negateFilter: boolean;

    private readonly _indexName: string;
    private readonly _collectionName: string;
    private _currentClauseDepth: number;

    protected _queryRaw: string;

    public get indexName() {
        return this._indexName;
    }

    public get collectionName() {
        return this._collectionName;
    }

    protected _filterModeStack: boolean[] = [];

    protected _queryParameters: { [key: string]: object } = {};

    protected _isIntersect: boolean;

    protected _isGroupBy: boolean;

    protected _theSession: InMemoryDocumentSessionOperations;

    protected _pageSize: number;

    protected _selectTokens: QueryToken[] = [];

    protected _fromToken: FromToken;
    protected _declareTokens: DeclareToken[];
    protected _loadTokens: LoadToken[];
    public fieldsToFetchToken: FieldsToFetchToken;

    public _isProjectInto: boolean;

    protected _whereTokens: QueryToken[] = [];

    protected _groupByTokens: QueryToken[] = [];

    protected _orderByTokens: QueryToken[] = [];

    protected _withTokens: QueryToken[] = [];

    protected _filterTokens: QueryToken[] = [];

    protected _start: number;

    private readonly _conventions: DocumentConventions;

    /**
     * Limits filter clause.
     */
    protected _filterLimit: number;

    protected _timeout: number;

    protected _theWaitForNonStaleResults: boolean;

    protected _documentIncludes: Set<string> = new Set();

    private _statsCallback: (stats: QueryStatistics) => void = TypeUtil.NOOP;

    /**
     * Holds the query stats
     */
    protected _queryStats: QueryStatistics = new QueryStatistics();

    protected _disableEntitiesTracking: boolean;

    protected _disableCaching: boolean;

    protected projectionBehavior: ProjectionBehavior;

    private _parameterPrefix = "p";

    private _includesAlias: string;

    protected _highlightingTokens: HighlightingToken[] = [];

    protected _queryHighlightings: QueryHighlightings = new QueryHighlightings();

    protected _queryTimings: QueryTimings;

    protected _explanations: Explanations;

    protected _explanationToken: ExplanationToken;

    protected isFilterActive(): boolean {
        return this._filterModeStack.length && this._filterModeStack[0];
    }


    public get isDistinct(): boolean {
        return this._selectTokens
            && this._selectTokens.length
            && this._selectTokens[0] instanceof DistinctToken;
    }

    public get theWaitForNonStaleResults() {
        return this._theWaitForNonStaleResults;
    }

    public get timeout() {
        return this._timeout;
    }

    public get queryParameters() {
        return this._queryParameters;
    }

    public get selectTokens() {
        return this._selectTokens;
    }

    public get isProjectInto() {
        return this._isProjectInto;
    }

    public set isProjectInto(value: boolean) {
        this._isProjectInto = value;
    }

    /**
     * Gets the document convention from the query session
     */
    public get conventions(): DocumentConventions {
        return this._conventions;
    }

    /**
     * Gets the session associated with this document query
     */
    public get session() {
        return this._theSession as any as IDocumentSession;
    }

    public isDynamicMapReduce(): boolean {
        return this._groupByTokens && !!this._groupByTokens.length;
    }

    private _isInMoreLikeThis: boolean;

    private _getDefaultTimeout(): number {
        return this._conventions.waitForNonStaleResultsTimeout;
    }

    protected constructor(
        clazz: DocumentType<T>,
        session: InMemoryDocumentSessionOperations,
        indexName: string,
        collectionName: string,
        isGroupBy: boolean,
        declareTokens: DeclareToken[],
        loadTokens: LoadToken[]);
    protected constructor(
        clazz: DocumentType<T>,
        session: InMemoryDocumentSessionOperations,
        indexName: string,
        collectionName: string,
        isGroupBy: boolean,
        declareTokens: DeclareToken[],
        loadTokens: LoadToken[],
        fromAlias: string,
        isProjectInto: boolean
    );
    protected constructor(
        clazz: DocumentType<T>,
        session: InMemoryDocumentSessionOperations,
        indexName: string,
        collectionName: string,
        isGroupBy: boolean,
        declareTokens: DeclareToken[],
        loadTokens: LoadToken[],
        fromAlias: string = null,
        isProjectInto: boolean = false) {
        super();

        this._clazz = clazz;
        this._rootTypes.add(clazz);
        this._isGroupBy = isGroupBy;
        this._indexName = indexName;
        this._collectionName = collectionName;
        this._fromToken = FromToken.create(indexName, collectionName, fromAlias);
        this._declareTokens = declareTokens;
        this._loadTokens = loadTokens;

        this._theSession = session;

        this.on("afterQueryExecuted", (result: QueryResult) => {
            this._updateStatsAndHighlightingsAndExplanations(result);
        });

        this._conventions = !session ?
            new DocumentConventions() :
            session.conventions;
        // TBD _linqPathProvider = new LinqPathProvider(_conventions);
        this._isProjectInto = isProjectInto || false;
    }

    private _assertMethodIsCurrentlySupported(methodName: string) {
        if (!this.isFilterActive()) {
            return;
        }

        throwError("InvalidQueryException", methodName
            + " is currently unsupported for 'filter'. If you want to use"
            + methodName + " in where method you have to put it before 'filter'");

    }

    private _getCurrentWhereTokens(): QueryToken[] {
        if (this.isFilterActive()) {
            return this._filterTokens;
        }

        if (!this._isInMoreLikeThis) {
            return this._whereTokens;
        }

        if (!this._whereTokens || !this._whereTokens.length) {
            throwError("InvalidOperationException",
                "Cannot get MoreLikeThisToken because there are no where token specified.");
        }
        const lastToken = this._whereTokens.at(-1);

        if (lastToken instanceof MoreLikeThisToken) {
            return lastToken.whereTokens;
        } else {
            throwError("InvalidOperationException", "Last token is not MoreLikeThisToken");
        }
    }

    private _ensureValidFieldName(fieldName: string, isNestedPath: boolean): string {
        if (!this._theSession
            || !this._theSession.conventions
            || isNestedPath
            || this._isGroupBy) {
            return QueryFieldUtil.escapeIfNecessary(fieldName, isNestedPath);
        }

        for (const rootType of this._rootTypes) {
            const identityProperty = this._theSession.conventions.getIdentityProperty(rootType);
            if (identityProperty && identityProperty === fieldName) {
                return CONSTANTS.Documents.Indexing.Fields.DOCUMENT_ID_FIELD_NAME;
            }
        }

        return QueryFieldUtil.escapeIfNecessary(fieldName);
    }

    private _appendOperatorIfNeeded(tokens: QueryToken[]): void {
        this._assertNoRawQuery();

        if (!tokens || !tokens.length) {
            return;
        }

        const lastToken = tokens.at(-1);
        if (!(lastToken instanceof WhereToken) && !(lastToken instanceof CloseSubclauseToken)) {
            return;
        }

        let lastWhere: WhereToken = null;

        for (let i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i] instanceof WhereToken) {
                lastWhere = tokens[i] as WhereToken;
                break;
            }
        }

        let token: QueryOperatorToken = this._defaultOperator === "AND"
            ? QueryOperatorToken.AND
            : QueryOperatorToken.OR;

        if (lastWhere
            && lastWhere.options?.searchOperator) {
            token = QueryOperatorToken.OR; // default to OR operator after search if AND was not specified explicitly
        }

        tokens.push(token);
    }

    private _transformCollection(fieldName: string, values: any[]): object[] {
        const result: object[] = [];
        for (const value of values) {
            if (Array.isArray(value)) {
                result.push(...this._transformCollection(fieldName, value));
            } else {
                const nestedWhereParams = new WhereParams();
                nestedWhereParams.allowWildcards = true;
                nestedWhereParams.fieldName = fieldName;
                nestedWhereParams.value = value;

                result.push(this._transformValue(nestedWhereParams));
            }
        }

        return result;
    }

    private _negateIfNeeded(tokens: QueryToken[], fieldName: string): void {
        if (!this._negate) {
            return;
        }

        this._negate = false;

        if (!tokens || !tokens.length || tokens.at(-1) instanceof OpenSubclauseToken) {
            if (fieldName) {
                this._whereExists(fieldName);
            } else {
                this._whereTrue();
            }

            this._andAlso();
        }

        tokens.push(NegateToken.INSTANCE);
    }

    public _usingDefaultOperator(operator): void {
        if (this._getCurrentWhereTokens().length > 0) {
            throwError("InvalidOperationException",
                "Default operator can only be set before any where clause is added.");
        }

        this._defaultOperator = operator;
    }

    /**
     * Instruct the query to wait for non stale result for the specified wait timeout.
     * This shouldn't be used outside of unit tests unless you are well aware of the implications
     */
    public _waitForNonStaleResults(waitTimeout?: number): void {
        if (this._theWaitForNonStaleResults) {
            if (!this._timeout || waitTimeout && this._timeout < waitTimeout) {
                this._timeout = waitTimeout;
            }
            return;
        }
        this._theWaitForNonStaleResults = true;
        this._timeout = waitTimeout || this._getDefaultTimeout();
    }

    protected _getLazyQueryOperation() {
        if (!this._queryOperation) {
            this._queryOperation = this.initializeQueryOperation();
        }

        const clazz = this._conventions.getJsTypeByDocumentType(this._clazz);
        return  new LazyQueryOperation<T>(
            this._theSession,
            this._queryOperation,
            this,
            clazz);
    }

    public initializeQueryOperation(): QueryOperation {
        const beforeQueryEventArgs = new SessionBeforeQueryEventArgs(
            this._theSession, new DocumentQueryCustomization(this));
        this._theSession.emit("beforeQuery", beforeQueryEventArgs);

        const indexQuery = this.getIndexQuery();
        return new QueryOperation(
            this._theSession,
            this._indexName,
            indexQuery,
            this.fieldsToFetchToken,
            this._disableEntitiesTracking,
            false,
            false,
            this._isProjectInto);
    }

    private _transformValue(whereParams: WhereParams): any;
    private _transformValue(whereParams: WhereParams, forRange: boolean): any;
    private _transformValue(whereParams: WhereParams, forRange: boolean = false): any {
        if (TypeUtil.isNullOrUndefined(whereParams.value)) {
            return null;
        }

        if ("" === (whereParams.value as any)) {
            return "";
        }

        let objectValue: string = null;

        if (this._conventions.tryConvertValueToObjectForQuery(whereParams.fieldName,
            whereParams.value, forRange, s => objectValue = s)) {
            return objectValue;
        }

        const value = whereParams.value;
        return this._stringifyParameter(value);
    }

    private _stringifyParameter(value: any) {
        if (TypeUtil.isDate(value)) {
            return DateUtil.utc.stringify(value);
        }

        if (TypeUtil.isString(value)) {
            return value;
        }

        if (TypeUtil.isNumber(value)) {
            return value;
        }

        if ((value as any) === false || (value as any) === true) {
            return value;
        }

        return value || null;
    }

    private _addQueryParameter(value: any): string {
        const parameterName = this.parameterPrefix + Object.keys(this._queryParameters).length;
        this._queryParameters[parameterName] = this._stringifyParameter(value);
        return parameterName;
    }

    protected static _getSourceAliasIfExists<TResult extends object>(documentType: DocumentType<TResult>,
                                                                     queryData: QueryData,
                                                                     fields: string[],
                                                                     sourceAlias: (value: string) => void) {
        sourceAlias(null);

        if (fields.length !== 1 || !fields[0]) {
            return;
        }

        const indexOf = fields[0].indexOf(".");
        if (indexOf === -1) {
            return;
        }

        const possibleAlias = fields[0].substring(0, indexOf);

        if (queryData.fromAlias && queryData.fromAlias === possibleAlias) {
            sourceAlias(possibleAlias);
            return;
        }

        if (!queryData.loadTokens || queryData.loadTokens.length === 0) {
            return;
        }

        if (!queryData.loadTokens.some(x => x.alias === possibleAlias)) {
            return;
        }

        sourceAlias(possibleAlias);
    }

    protected _createTimeSeriesQueryData(timeSeriesQuery: (builder: ITimeSeriesQueryBuilder) => void) {
        const builder = new TimeSeriesQueryBuilder();
        timeSeriesQuery(builder);

        const fields = [ TIME_SERIES.SELECT_FIELD_NAME + "(" + builder.queryText + ")"];
        const projections = [ TIME_SERIES.QUERY_FUNCTION ];
        return new QueryData(fields, projections);
    }

    public _addFilterLimit(filterLimit: number) {
        if (filterLimit <= 0) {
            throwError("InvalidOperationException", "filterLimit need to be positive and bigger than 0.");
        }

        if (filterLimit !== Number.MAX_SAFE_INTEGER) {
            this._filterLimit = filterLimit;
        }
    }

    private _getCurrentOrderByTokens() {
        return this._orderByTokens;
    }

    private _getCurrentFilterTokens() {
        return this._filterTokens;
    }

    protected _updateFieldsToFetchToken(fieldsToFetch: FieldsToFetchToken): void {
        this.fieldsToFetchToken = fieldsToFetch;

        if (this._selectTokens && !this._selectTokens.length) {
            this._selectTokens.push(fieldsToFetch);
        } else {
            const fetchToken = [...this._selectTokens]
                .find(x => x instanceof FieldsToFetchToken);

            if (fetchToken) {
                const idx = this._selectTokens.indexOf(fetchToken);
                this._selectTokens[idx] = fieldsToFetch;
            } else {
                this._selectTokens.push(fieldsToFetch);
            }
        }
    }

    public getIndexQuery(): IndexQuery {
        let serverVersion: string = null;
        if (this._theSession && this._theSession.requestExecutor) {
            serverVersion = this._theSession.requestExecutor.lastServerVersion;
        }

        const compatibilityMode = serverVersion && serverVersion.localeCompare("4.2") < 0;
        const query = this.toString(compatibilityMode);
        const indexQuery = this._generateIndexQuery(query);
        this.emit("beforeQueryExecuted", indexQuery);
        return indexQuery;
    }

    /**
     * Gets the fields for projection
     */
    public getProjectionFields(): string[] {
        return this.fieldsToFetchToken &&
        this.fieldsToFetchToken.projections
            ? [...this.fieldsToFetchToken.projections]
            : [] as string[];
    }

    /**
     * Order the search results randomly using the specified seed
     * this is useful if you want to have repeatable random queries
     */
    public _randomOrdering(): void;
    /**
     * Order the search results randomly using the specified seed
     * this is useful if you want to have repeatable random queries
     */
    public _randomOrdering(seed?: string): void;
    /**
     * Order the search results randomly using the specified seed
     * this is useful if you want to have repeatable random queries
     */
    public _randomOrdering(seed?: string): void {
        this._assertNoRawQuery();

        this._noCaching();

        if (!seed) {
            this._orderByTokens.push(OrderByToken.random);
            return;
        }

        this._orderByTokens.push(OrderByToken.createRandom(seed));
    }

    // TBD public void _customSortUsing(String typeName)
    // TBD public void _customSortUsing(String typeName, boolean descending)

    public _projection(projectionBehavior: ProjectionBehavior) {
        this.projectionBehavior = projectionBehavior;
    }

    protected addGroupByAlias(fieldName: string, projectedName: string): void {
        this._aliasToGroupByFieldName[projectedName] = fieldName;
    }

    private _assertNoRawQuery(): void {
        if (this._queryRaw) {
            throwError("InvalidOperationException",
                "RawQuery was called, cannot modify this query by calling on "
                + "operations that would modify the query (such as Where, Select, OrderBy, GroupBy, etc)");
        }
    }

    public addParameter(name: string, value: any): void {
        name = name.replace(/^\$/, "");
        if (Object.keys(this._queryParameters).includes(name)) {
            throwError("InvalidOperationException",
                "The parameter " + name + " was already added");
        }

        this._queryParameters[name] = value;
    }

    public _groupBy(fieldName: string, ...fieldNames: string[]): void;
    public _groupBy(field: GroupBy, ...fields: GroupBy[]): void;
    public _groupBy(fieldOrFieldName: GroupBy | string, ...fieldsOrFieldNames: any[]): void {

        if (typeof (fieldOrFieldName) === "string") {
            const mapping = fieldsOrFieldNames.map(x => GroupBy.field(x));
            this._groupBy(GroupBy.field(fieldOrFieldName), ...mapping);
            return;
        }

        if (!this._fromToken.isDynamic) {
            throwError("InvalidOperationException",
                "groupBy only works with dynamic queries");
        }

        this._assertNoRawQuery();
        this._isGroupBy = true;

        const fieldName = this._ensureValidFieldName((fieldOrFieldName as GroupBy).field, false);

        this._groupByTokens.push(GroupByToken.create(fieldName, (fieldOrFieldName as GroupBy).method));

        if (!fieldsOrFieldNames || !fieldsOrFieldNames.length) {
            return;
        }

        for (const item of fieldsOrFieldNames) {
            fieldOrFieldName = this._ensureValidFieldName((item as GroupBy).field, false);
            this._groupByTokens.push(GroupByToken.create(fieldOrFieldName, (item as GroupBy).method));
        }
    }

    public _groupByKey(fieldName: string): void;
    public _groupByKey(fieldName: string, projectedName: string): void;
    public _groupByKey(fieldName: string, projectedName: string = null): void {
        this._assertNoRawQuery();
        this._isGroupBy = true;

        if (projectedName && this._aliasToGroupByFieldName[projectedName]) {
            const aliasedFieldName = this._aliasToGroupByFieldName[projectedName];
            if (!fieldName || fieldName.toLocaleLowerCase() === (projectedName || "").toLocaleLowerCase()) {
                fieldName = aliasedFieldName;
            }
        } else if (fieldName
            && Object.keys(this._aliasToGroupByFieldName)
                .reduce((result, next) => result || next === fieldName, false)) {
            fieldName = this._aliasToGroupByFieldName[fieldName];
        }

        this._selectTokens.push(GroupByKeyToken.create(fieldName, projectedName));
    }

    public _groupBySum(fieldName: string): void;
    public _groupBySum(fieldName: string, projectedName: string): void;
    public _groupBySum(fieldName: string, projectedName: string = null): void {
        this._assertNoRawQuery();
        this._isGroupBy = true;

        fieldName = this._ensureValidFieldName(fieldName, false);
        this._selectTokens.push(GroupBySumToken.create(fieldName, projectedName));
    }

    public _groupByCount(): void;
    public _groupByCount(projectedName: string): void;
    public _groupByCount(projectedName: string = null): void {
        this._assertNoRawQuery();
        this._isGroupBy = true;

        this._selectTokens.push(GroupByCountToken.create(projectedName));
    }

    public _whereTrue(): void {
        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, null);

        tokens.push(TrueToken.INSTANCE);
    }

    public _moreLikeThis(): MoreLikeThisScope {
        this._appendOperatorIfNeeded(this._whereTokens);

        const token = new MoreLikeThisToken();
        this._whereTokens.push(token);

        this._isInMoreLikeThis = true;

        return new MoreLikeThisScope(token, v => this._addQueryParameter(v), () => this._isInMoreLikeThis = false);
    }

    /**
     * Includes the specified path in the query, loading the document specified in that path
     */
    public _include(path: string): void;
    public _include(includes: IncludeBuilderBase): void;
    public _include(pathOrIncludes: string | IncludeBuilderBase): void {
        if (!pathOrIncludes) {
            return;
        }

        if (TypeUtil.isString(pathOrIncludes)) {
            this._documentIncludes.add(pathOrIncludes);
            return;
        }

        const { documentsToInclude } = pathOrIncludes;
        if (documentsToInclude) {
            for (const doc of documentsToInclude) {
                this._documentIncludes.add(doc);
            }
        }

        this._includeCounters(pathOrIncludes.alias, pathOrIncludes.countersToIncludeBySourcePath);

        if (pathOrIncludes.timeSeriesToIncludeBySourceAlias) {
            this._includeTimeSeries(pathOrIncludes.alias, pathOrIncludes.timeSeriesToIncludeBySourceAlias);
        }

        if (pathOrIncludes.revisionsToIncludeByDateTime) {
            this._includeRevisionsByDate(pathOrIncludes.revisionsToIncludeByDateTime);
        }

        if (pathOrIncludes.revisionsToIncludeByChangeVector) {
            this._includeRevisionsByChangeVector(pathOrIncludes.revisionsToIncludeByChangeVector);
        }

        if (pathOrIncludes.compareExchangeValuesToInclude) {
            this._compareExchangeValueIncludesTokens = [];

            for (const compareExchangeValue of pathOrIncludes.compareExchangeValuesToInclude) {
                this._compareExchangeValueIncludesTokens.push(CompareExchangeValueIncludesToken.create(compareExchangeValue));
            }
        }
    }

    // TBD: public void Include(Expression<Func<T, object>> path)

    public _take(count: number): void {
        this._pageSize = count;
    }

    public _skip(count: number): void {
        this._start = count;
    }

    /**
     * Filter the results from the index using the specified where clause.
     */
    public _whereLucene(fieldName: string, whereClause: string, exact: boolean): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const options = exact ? new WhereOptions({ exact }) : null;
        const whereToken = WhereToken.create("Lucene", fieldName, this._addQueryParameter(whereClause), options);
        tokens.push(whereToken);
    }

    /**
     * Simplified method for opening a new clause within the query
     */
    public _openSubclause(): void {
        this._currentClauseDepth++;

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, null);

        tokens.push(OpenSubclauseToken.create());
    }

    /**
     * Simplified method for closing a clause within the query
     */
    public _closeSubclause(): void {
        this._currentClauseDepth--;

        const tokens: QueryToken[] = this._getCurrentWhereTokens();
        tokens.push(CloseSubclauseToken.create());
    }

    public _whereEquals(fieldName: string, method: MethodCall): void;
    public _whereEquals(fieldName: string, method: MethodCall, exact: boolean): void;
    public _whereEquals(fieldName: string, value: any): void;
    public _whereEquals(fieldName: string, value: any, exact: boolean): void;
    public _whereEquals(whereParams: WhereParams): void;
    public _whereEquals(fieldNameOrWhereParams: string | WhereParams, value?: object, exact: boolean = false): void {
        if (!TypeUtil.isObject(fieldNameOrWhereParams)) {
            const params = new WhereParams();
            params.fieldName = fieldNameOrWhereParams as string;
            params.value = value;
            params.exact = exact;
            this._whereEquals(params);
            return;
        }

        const whereParams = fieldNameOrWhereParams as WhereParams;
        if (this._negate) {
            this._negate = false;
            this._whereNotEquals(whereParams);
            return;
        }

        whereParams.fieldName = this._ensureValidFieldName(whereParams.fieldName, whereParams.nestedPath);

        const tokens: QueryToken[] = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);

        if (this._ifValueIsMethod("Equals", whereParams, tokens)) {
            return;
        }

        const transformToEqualValue = this._transformValue(whereParams);
        const addQueryParameter: string = this._addQueryParameter(transformToEqualValue);
        const whereToken = WhereToken.create(
            "Equals",
            whereParams.fieldName,
            addQueryParameter,
            new WhereOptions({
                exact: whereParams.exact
            }));
        tokens.push(whereToken);
    }

    private _ifValueIsMethod(op: WhereOperator, whereParams: WhereParams, tokens: QueryToken[]): boolean {
        if (whereParams.value instanceof MethodCall) {
            const mc = whereParams.value as MethodCall;

            const args = mc.args.map(() => null);
            for (let i = 0; i < mc.args.length; i++) {
                args[i] = this._addQueryParameter(mc.args[i]);
            }

            let token: WhereToken;
            const type = mc.constructor.name;
            if (CmpXchg.name === type) {
                token = WhereToken.create(
                    op,
                    whereParams.fieldName,
                    null,
                    new WhereOptions({
                        methodType: "CmpXchg",
                        parameters: args,
                        property: mc.accessPath,
                        exact: whereParams.exact
                    }));
            } else {
                throwError("InvalidArgumentException", `Unknown method ${type}.`);
            }

            tokens.push(token);
            return true;
        }

        return false;
    }

    public _whereNotEquals(fieldName: string, value: any): void;
    public _whereNotEquals(fieldName: string, value: any, exact: boolean): void;
    public _whereNotEquals(fieldName: string, method: MethodCall): void;
    public _whereNotEquals(fieldName: string, method: MethodCall, exact: boolean): void;
    public _whereNotEquals(whereParams: WhereParams): void;
    public _whereNotEquals(fieldNameOrWhereParams: string | WhereParams, value?: object, exact: boolean = false): void {
        let whereParams: WhereParams;
        if (TypeUtil.isString(fieldNameOrWhereParams)) {
            whereParams = new WhereParams();
            whereParams.fieldName = fieldNameOrWhereParams as string;
            whereParams.value = value;
            whereParams.exact = exact;

            return this._whereNotEquals(whereParams);
        }

        whereParams = fieldNameOrWhereParams as WhereParams;
        if (this._negate) {
            this._negate = false;
            this._whereEquals(whereParams);
            return;
        }

        const transformToEqualValue = this._transformValue(whereParams);

        const tokens: QueryToken[] = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);

        whereParams.fieldName = this._ensureValidFieldName(whereParams.fieldName, whereParams.nestedPath);

        if (this._ifValueIsMethod("NotEquals", whereParams, tokens)) {
            return;
        }

        const whereToken = WhereToken.create(
            "NotEquals",
            whereParams.fieldName,
            this._addQueryParameter(transformToEqualValue),
            new WhereOptions(whereParams.exact));
        tokens.push(whereToken);
    }

    public _negateNext(): void {
        this._negate = !this._negate;
    }

    /**
     * Check that the field has one of the specified value
     */
    public _whereIn(fieldName: string, values: any[]): void;
    /**
     * Check that the field has one of the specified value
     */
    public _whereIn(fieldName: string, values: any[], exact: boolean): void;
    /**
     * Check that the field has one of the specified value
     */
    public _whereIn(fieldName: string, values: any[], exact: boolean = false): void {
        this._assertMethodIsCurrentlySupported("whereIn");

        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const whereToken = WhereToken.create(
            "In",
            fieldName,
            this._addQueryParameter(
                this._transformCollection(fieldName, AbstractDocumentQuery._unpackCollection(values))));
        tokens.push(whereToken);
    }

    public _whereStartsWith(fieldName: string, value: any, exact: boolean = false): void {
        this._assertMethodIsCurrentlySupported("whereStartsWith");

        const whereParams = new WhereParams();
        whereParams.fieldName = fieldName;
        whereParams.value = value;
        whereParams.allowWildcards = true;

        const transformToEqualValue = this._transformValue(whereParams);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);

        whereParams.fieldName = this._ensureValidFieldName(whereParams.fieldName, whereParams.nestedPath);
        this._negateIfNeeded(tokens, whereParams.fieldName);

        const whereToken = WhereToken.create(
            "StartsWith", whereParams.fieldName, this._addQueryParameter(transformToEqualValue), new WhereOptions({
                exact
            }));
        tokens.push(whereToken);
    }

    /**
     * Matches fields which ends with the specified value.
     */
    public _whereEndsWith(fieldName: string, value: any, exact: boolean = false): void {
        this._assertMethodIsCurrentlySupported("whereEndsWith");

        const whereParams = new WhereParams();
        whereParams.fieldName = fieldName;
        whereParams.value = value;
        whereParams.allowWildcards = true;

        const transformToEqualValue = this._transformValue(whereParams);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);

        whereParams.fieldName = this._ensureValidFieldName(whereParams.fieldName, whereParams.nestedPath);
        this._negateIfNeeded(tokens, whereParams.fieldName);

        const whereToken = WhereToken.create(
            "EndsWith", whereParams.fieldName, this._addQueryParameter(transformToEqualValue), new WhereOptions({
                exact
            }));
        tokens.push(whereToken);
    }

    /**
     * Matches fields where the value is between the specified start and end, inclusive
     */
    public _whereBetween(fieldName: string, start: any, end: any): void;
    /**
     * Matches fields where the value is between the specified start and end, inclusive
     */
    public _whereBetween(fieldName: string, start: any, end: any, exact: boolean): void;
    /**
     * Matches fields where the value is between the specified start and end, inclusive
     */
    public _whereBetween(fieldName: string, start: any, end: any, exact: boolean = false): void {
        this._assertMethodIsCurrentlySupported("whereBetween");

        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const startParams = new WhereParams();
        startParams.value = start;
        startParams.fieldName = fieldName;

        const endParams = new WhereParams();
        endParams.value = end;
        endParams.fieldName = fieldName;

        const fromParameterName = this._addQueryParameter(
            !start ? "*" : this._transformValue(startParams, true));
        const toParameterName = this._addQueryParameter(
            !end ? "NULL" : this._transformValue(endParams, true));

        const whereToken = WhereToken.create(
            "Between", fieldName, null, new WhereOptions({
                exact,
                from: fromParameterName,
                to: toParameterName
            }));
        tokens.push(whereToken);
    }

    /**
     * Matches fields where the value is greater than the specified value
     */
    public _whereGreaterThan(fieldName: string, value: any): void;
    /**
     * Matches fields where the value is greater than the specified value
     */
    public _whereGreaterThan(fieldName: string, value: any, exact: boolean): void;
    /**
     * Matches fields where the value is greater than the specified value
     */
    public _whereGreaterThan(fieldName: string, value: any, exact: boolean = false): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);
        const whereParams = new WhereParams();
        whereParams.value = value;
        whereParams.fieldName = fieldName;

        const parameter = this._addQueryParameter(
            !value ? "*" : this._transformValue(whereParams, true));

        const whereToken = WhereToken.create(
            "GreaterThan", fieldName, parameter, new WhereOptions({ exact }));
        tokens.push(whereToken);
    }

    /**
     * Matches fields where the value is greater than or equal to the specified value
     */
    public _whereGreaterThanOrEqual(fieldName: string, value: any): void;
    /**
     * Matches fields where the value is greater than or equal to the specified value
     */
    public _whereGreaterThanOrEqual(fieldName: string, value: any, exact: boolean): void;
    /**
     * Matches fields where the value is greater than or equal to the specified value
     */
    public _whereGreaterThanOrEqual(fieldName: string, value: any, exact: boolean = false): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);
        const whereParams = new WhereParams();
        whereParams.value = value;
        whereParams.fieldName = fieldName;

        const parameter = this._addQueryParameter(
            !value ? "*" : this._transformValue(whereParams, true));
        const whereToken = WhereToken.create(
            "GreaterThanOrEqual", fieldName, parameter, new WhereOptions({ exact }));
        tokens.push(whereToken);
    }

    public _whereLessThan(fieldName: string, value: any): void;
    public _whereLessThan(fieldName: string, value: any, exact: boolean): void;
    public _whereLessThan(fieldName: string, value: any, exact: boolean = false): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const whereParams = new WhereParams();
        whereParams.value = value;
        whereParams.fieldName = fieldName;

        const parameter = this._addQueryParameter(
            !value ? "NULL" : this._transformValue(whereParams, true));
        const whereToken = WhereToken.create(
            "LessThan", fieldName, parameter, new WhereOptions({ exact }));
        tokens.push(whereToken);
    }

    public _whereLessThanOrEqual(fieldName: string, value: any): void;
    public _whereLessThanOrEqual(fieldName: string, value: any, exact: boolean): void;
    public _whereLessThanOrEqual(fieldName: string, value: any, exact: boolean = false): void {
        fieldName = this._ensureValidFieldName(fieldName, false);
        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const whereParams = new WhereParams();
        whereParams.value = value;
        whereParams.fieldName = fieldName;

        const parameter = this._addQueryParameter(
            !value ? "NULL" : this._transformValue(whereParams, true));
        const whereToken = WhereToken.create(
            "LessThanOrEqual", fieldName, parameter, new WhereOptions({ exact }));
        tokens.push(whereToken);
    }

    /**
     * Matches fields where Regex.IsMatch(filedName, pattern)
     */
    public _whereRegex(fieldName: string, pattern: string): void {
        this._assertMethodIsCurrentlySupported("whereRegex");

        fieldName = this._ensureValidFieldName(fieldName, false);
        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const whereParams = new WhereParams();
        whereParams.value = pattern;
        whereParams.fieldName = fieldName;

        const parameter = this._addQueryParameter(this._transformValue(whereParams));

        const whereToken = WhereToken.create(
            "Regex", fieldName, parameter);
        tokens.push(whereToken);
    }

    public _andAlso(wrapPreviousQueryClauses: boolean = false): void {
        const tokens = this._getCurrentWhereTokens();
        if (!tokens || !tokens.length) {
            return;
        }

        if (tokens.at(-1) instanceof QueryOperatorToken) {
            throwError("InvalidOperationException",
                "Cannot add AND, previous token was already an operator token.");
        }

        if (wrapPreviousQueryClauses) {
            tokens.unshift(OpenSubclauseToken.create());
            tokens.push(CloseSubclauseToken.create());
            tokens.push(QueryOperatorToken.AND);
        } else {
            tokens.push(QueryOperatorToken.AND);
        }
    }

    /**
     * Add an OR to the query
     */
    public _orElse(): void {
        const tokens = this._getCurrentWhereTokens();
        if (!tokens && !tokens.length) {
            return;
        }

        if (tokens.at(-1) instanceof QueryOperatorToken) {
            throwError("InvalidOperationException",
                "Cannot add OR, previous token was already an operator token.");
        }

        tokens.push(QueryOperatorToken.OR);
    }

    public setFilterMode(on: boolean): IDisposable {
        return new FilterModeScope(this._filterModeStack, on);
    }


    /**
     * Specifies a boost weight to the previous where clause.
     * The higher the boost factor, the more relevant the term will be.
     * <p>
     * boosting factor where 1.0 is default, less than 1.0 is lower weight, greater than 1.0 is higher weight
     * <p>
     * http://lucene.apache.org/java/2_4_0/queryparsersyntax.html#Boosting%20a%20Term
     */
    public _boost(boost: number): void {
        this._assertMethodIsCurrentlySupported("boost");

        if (boost === 1.0) {
            return;
        }

        if (boost < 0.0) {
            throwError("InvalidArgumentException", "Boost factor must be a non-negative number");
        }

        const tokens = this._getCurrentWhereTokens();

        let last = tokens.length ? tokens.at(-1) : null;

        if (last instanceof WhereToken) {
            last.options.boost = boost;
        } else if (last instanceof CloseSubclauseToken) {
            const parameter = this._addQueryParameter(boost);

            const close = last;

            let openSubclauseToSkip = 0;
            let index = tokens.indexOf(last);

            while (last && index > 0) {
                index--;
                last = tokens[index]; // find the previous option

                if (last instanceof CloseSubclauseToken) {
                    // We have to count how many inner subclauses were inside current subclause
                    openSubclauseToSkip++;
                } else if (last instanceof OpenSubclauseToken && openSubclauseToSkip > 0) {
                    // Inner subclause open - we have to skip it because we want to match only the leftmost opening.
                    openSubclauseToSkip--;
                } else if (last instanceof OpenSubclauseToken) {
                    last.boostParameterName = parameter;
                    close.boostParameterName = parameter;
                }
            }
        } else {
            throwError("InvalidOperationException", "Cannot apply boost");
        }
    }

    /**
     * Specifies a fuzziness factor to the single word term in the last where clause
     * <p>
     * 0.0 to 1.0 where 1.0 means closer match
     * <p>
     * https://lucene.apache.org/core/2_9_4/queryparsersyntax.html#Fuzzy%20Searches
     */
    public _fuzzy(fuzzy: number): void {
        this._assertMethodIsCurrentlySupported("fuzzy");

        const tokens = this._getCurrentWhereTokens();
        if (!tokens && !tokens.length) {
            throwError("InvalidOperationException", "Fuzzy can only be used right after where clause.");
        }

        const whereToken = tokens.at(-1);
        if (!(whereToken instanceof WhereToken)) {
            throwError("InvalidOperationException", "Fuzzy can only be used right after where clause.");
        }

        if ((whereToken as WhereToken).whereOperator !== "Equals" as WhereOperator) {
            throwError("InvalidOperationException",
                "Fuzzy can only be used right after where clause with equals operator");
        }

        if (fuzzy < 0.0 || fuzzy > 1.0) {
            throwError("InvalidArgumentException", "Fuzzy distance must be between 0.0 and 1.0.");
        }

        (whereToken as WhereToken).options.fuzzy = fuzzy;
    }

    /**
     * Specifies a proximity distance for the phrase in the last search clause
     * <p>
     * https://lucene.apache.org/core/2_9_4/queryparsersyntax.html#Proximity%20Searches
     */
    public _proximity(proximity: number): void {
        this._assertMethodIsCurrentlySupported("proximity");
        const tokens = this._getCurrentWhereTokens();
        if (!tokens && !tokens.length) {
            throwError("InvalidOperationException", "Proximity can only be used right after search clause.");
        }

        const whereToken = tokens.at(-1);
        if (!(whereToken instanceof WhereToken)) {
            throwError("InvalidOperationException", "Proximity can only be used right after search clause.");
        }

        if ((whereToken as WhereToken).whereOperator !== "Search" as WhereOperator) {
            throwError("InvalidOperationException",
                "Proximity can only be used right after search clause");
        }

        if (proximity < 0) {
            throwError("InvalidArgumentException", "Proximity distance must be a number greater than or equal to 0");
        }

        (whereToken as WhereToken).options.proximity = proximity;
    }

    /**
     * Order the results by the specified fields
     * The fields are the names of the fields to sort, defaulting to sorting by ascending.
     * You can prefix a field name with '-' to indicate sorting by descending or '+' to sort by ascending
     */
    public _orderBy(field: string): void;
    /**
     * Order the results by the specified fields
     * The fields are the names of the fields to sort, defaulting to sorting by ascending.
     * You can prefix a field name with '-' to indicate sorting by descending or '+' to sort by ascending
     */
    public _orderBy(field: string, ordering: OrderingType): void;
    public _orderBy(field: string, options: { sorterName: string });
    public _orderBy(field: string, orderingOrOptions: OrderingType | { sorterName: string } = "String"): void {
        if (TypeUtil.isString(orderingOrOptions)) {
            this._assertNoRawQuery();
            const f = this._ensureValidFieldName(field, false);
            this._orderByTokens.push(OrderByToken.createAscending(f, { ordering: orderingOrOptions }));
        } else {
            const sorterName = orderingOrOptions.sorterName;
            if (StringUtil.isNullOrEmpty(sorterName)) {
                throwError("InvalidArgumentException", "SorterName cannot be null or empty");
            }

            this._assertNoRawQuery();
            const f = this._ensureValidFieldName(field, false);
            this._orderByTokens.push(OrderByToken.createAscending(f, orderingOrOptions));
        }

    }

    /**
     * Order the results by the specified fields
     * The fields are the names of the fields to sort, defaulting to sorting by descending.
     * You can prefix a field name with '-' to indicate sorting by descending or '+' to sort by ascending
     */
    public _orderByDescending(field: string): void;
    /**
     * Order the results by the specified fields
     * The fields are the names of the fields to sort, defaulting to sorting by descending.
     * You can prefix a field name with '-' to indicate sorting by descending or '+' to sort by ascending
     */
    public _orderByDescending(field: string, ordering: OrderingType): void;
    public _orderByDescending(field: string, options: { sorterName: string });
    public _orderByDescending(field: string, orderingOrOptions: OrderingType | { sorterName: string } = "String"): void {
        if (TypeUtil.isString(orderingOrOptions)) {
            this._assertNoRawQuery();
            const f = this._ensureValidFieldName(field, false);
            this._orderByTokens.push(OrderByToken.createDescending(f, { ordering: orderingOrOptions }));
        } else {
            const sorterName = orderingOrOptions.sorterName;
            if (StringUtil.isNullOrEmpty(sorterName)) {
                throwError("InvalidArgumentException", "SorterName cannot be null or empty");
            }

            this._assertNoRawQuery();
            const f = this._ensureValidFieldName(field, false);
            this._orderByTokens.push(OrderByToken.createDescending(f, orderingOrOptions));
        }
    }

    public _orderByScore(): void {
        this._assertNoRawQuery();

        this._orderByTokens.push(OrderByToken.scoreAscending);
    }

    public _orderByScoreDescending(): void {
        this._assertNoRawQuery();
        this._orderByTokens.push(OrderByToken.scoreDescending);
    }

    /**
     * Provide statistics about the query, such as total count of matching records
     */
    public _statistics(statsCallback: (stats: QueryStatistics) => void): void {
        statsCallback(this._queryStats);
    }

    // TBD public void InvokeAfterStreamExecuted(BlittableJsonReaderObject result)

    /**
     * Generates the index query.
     */
    protected _generateIndexQuery(query: string): IndexQuery {
        const indexQuery = new IndexQuery();
        indexQuery.query = query;
        indexQuery.start = this._start;
        indexQuery.waitForNonStaleResults = this._theWaitForNonStaleResults;
        indexQuery.waitForNonStaleResultsTimeout = this._timeout;
        indexQuery.queryParameters = this._queryParameters;
        indexQuery.disableCaching = this._disableCaching;
        indexQuery.projectionBehavior = this.projectionBehavior;

        if (this._pageSize) {
            indexQuery.pageSize = this._pageSize;
        }

        return indexQuery;
    }

    /**
     * Perform a search for documents which fields that match the searchTerms.
     * If there is more than a single term, each of them will be checked independently.
     */
    public _search(fieldName: string, searchTerms: string): void;
    /**
     * Perform a search for documents which fields that match the searchTerms.
     * If there is more than a single term, each of them will be checked independently.
     */
    public _search(fieldName: string, searchTerms: string, operator: SearchOperator): void;
    /**
     * Perform a search for documents which fields that match the searchTerms.
     * If there is more than a single term, each of them will be checked independently.
     */
    public _search(fieldName: string, searchTerms: string, operator: SearchOperator = "OR"): void {
        this._assertMethodIsCurrentlySupported("search");
        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);

        fieldName = this._ensureValidFieldName(fieldName, false);
        this._negateIfNeeded(tokens, fieldName);

        const whereToken = WhereToken.create(
            "Search", fieldName, this._addQueryParameter(searchTerms), new WhereOptions({ search: operator }));
        tokens.push(whereToken);
    }

    public toString(compatibilityMode: boolean = false): string {
        if (this._queryRaw) {
            return this._queryRaw;
        }

        if (this._currentClauseDepth) {
            throwError("InvalidOperationException",
                "A clause was not closed correctly within this query, current clause depth = "
                + this._currentClauseDepth);
        }

        const queryText = new StringBuilder();
        this._buildDeclare(queryText);
        this._buildFrom(queryText);
        this._buildGroupBy(queryText);
        this._buildWhere(queryText);
        this._buildOrderBy(queryText);

        this._buildLoad(queryText);
        this._buildFilter(queryText);
        this._buildSelect(queryText);
        this._buildInclude(queryText);

        if (!compatibilityMode) {
            this._buildPagination(queryText);
        }

        return queryText.toString();
    }

    private _buildPagination(queryText: StringBuilder) {
        if (this._start > 0 || !TypeUtil.isNullOrUndefined(this._pageSize)) {
            queryText
                .append(" limit $")
                .append(this._addQueryParameter(this._start))
                .append(", $")
                .append(this._addQueryParameter(this._pageSize));
        }

        if (this._filterTokens.length > 0 && this._filterLimit > 0) {
            queryText
                .append(" filter_limit $")
                .append(this._addQueryParameter(this._filterLimit));
        }
    }

    private _buildInclude(queryText: StringBuilder): void {
        if (!this._documentIncludes.size
            && !this._highlightingTokens.length
            && !this._explanationToken
            && !this._queryTimings
            && !this._counterIncludesTokens
            && !this._revisionsIncludesTokens
            && !this._timeSeriesIncludesTokens
            && !this._compareExchangeValueIncludesTokens) {
            return;
        }

        queryText.append(" include ");

        const firstRef = {
            value: true
        };

        for (const include of this._documentIncludes) {
            if (!firstRef.value) {
                queryText.append(",");
            }
            firstRef.value = false;

            let escapedInclude: string;
            if (IncludesUtil.requiresQuotes(include, x => escapedInclude = x)) {
                queryText.append("'");
                queryText.append(escapedInclude);
                queryText.append("'");
            } else {
                queryText.append(include);
            }
        }

        this._writeIncludeTokens(this._counterIncludesTokens, firstRef, queryText);
        this._writeIncludeTokens(this._timeSeriesIncludesTokens, firstRef, queryText);
        this._writeIncludeTokens(this._revisionsIncludesTokens, firstRef, queryText);
        this._writeIncludeTokens(this._compareExchangeValueIncludesTokens, firstRef, queryText);
        this._writeIncludeTokens(this._highlightingTokens, firstRef, queryText);

        if (this._explanationToken) {
            if (!firstRef.value) {
                queryText.append(",");
            }

            firstRef.value = false;
            this._explanationToken.writeTo(queryText);
        }

        if (this._queryTimings) {
            if (!firstRef.value) {
                queryText.append(",");
            }
            firstRef.value = false;

            TimingsToken.instance.writeTo(queryText);
        }
    }

    private _writeIncludeTokens<TToken extends QueryToken>(tokens: TToken[], firstRef: { value: boolean }, queryText: StringBuilder) {
        if (!tokens) {
            return;
        }

        for (const token of tokens) {
            if (!firstRef.value) {
                queryText.append(",");
            }

            firstRef.value = false;

            token.writeTo(queryText);
        }
    }

    public _intersect(): void {
        const tokens = this._getCurrentWhereTokens();
        if (tokens.length > 0) {
            const last = tokens.at(-1);
            if (last instanceof WhereToken || last instanceof CloseSubclauseToken) {
                this._isIntersect = true;

                tokens.push(IntersectMarkerToken.INSTANCE);
                return;
            }
        }

        throwError("InvalidOperationException", "Cannot add INTERSECT at this point.");
    }

    public _whereExists(fieldName: string): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, null);


        tokens.push(WhereToken.create("Exists", fieldName, null));
    }

    public _containsAny(fieldName: string, values: any[]): void {
        this._assertMethodIsCurrentlySupported("containsAny");

        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const array = this._transformCollection(fieldName, AbstractDocumentQuery._unpackCollection(values));
        const whereToken = WhereToken.create(
            "In", fieldName, this._addQueryParameter(array), new WhereOptions({ exact: false }));
        tokens.push(whereToken);
    }

    public _containsAll(fieldName: string, values: any[]): void {
        this._assertMethodIsCurrentlySupported("containsAll");

        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const array = this._transformCollection(fieldName, AbstractDocumentQuery._unpackCollection(values));

        if (!array.length) {
            tokens.push(TrueToken.INSTANCE);
            return;
        }

        const whereToken = WhereToken.create(
            "AllIn", fieldName, this._addQueryParameter(array));
        tokens.push(whereToken);
    }

    public addRootType(clazz: DocumentType): void {
        this._rootTypes.add(clazz);
    }

    // TBD public string GetMemberQueryPathForOrderBy(Expression expression)
    // TBD public string GetMemberQueryPath(Expression expression)

    public _distinct(): void {
        if (this.isDistinct) {
            throwError("InvalidOperationException", "This is already a distinct query.");
        }

        if (!this._selectTokens.length) {
            this._selectTokens.push(DistinctToken.INSTANCE);
        } else {
            this._selectTokens.unshift(DistinctToken.INSTANCE);
        }
    }

    private _updateStatsAndHighlightingsAndExplanations(queryResult: QueryResult): void {
        this._queryStats.updateQueryStats(queryResult);
        this._queryHighlightings.update(queryResult);

        if (this._explanations) {
            this._explanations.update(queryResult);
        }

        if (this._queryTimings) {
            this._queryTimings.update(queryResult);
        }
    }

    private _buildSelect(writer: StringBuilder): void {
        if (!this._selectTokens || !this._selectTokens.length) {
            return;
        }

        writer.append(" select ");
        if (this._selectTokens.length === 1 && this._selectTokens[0] instanceof DistinctToken) {
            this._selectTokens[0].writeTo(writer);
            writer.append(" *");

            return;
        }

        for (let i = 0; i < this._selectTokens.length; i++) {
            const token = this._selectTokens[i];
            if (i > 0 && !(this._selectTokens[i - 1] instanceof DistinctToken)) {
                writer.append(",");
            }

            DocumentQueryHelper.addSpaceIfNeeded(
                i > 0 ? this._selectTokens[i - 1] : null, token, writer);

            token.writeTo(writer);
        }
    }

    private _buildFrom(writer: StringBuilder) {
        this._fromToken.writeTo(writer);
    }

    private _buildDeclare(writer: StringBuilder): void {
        if (!this._declareTokens) {
            return;
        }

        for (const token of this._declareTokens) {
            token.writeTo(writer);
        }
    }

    private _buildLoad(writer: StringBuilder): void {
        if (!this._loadTokens || !this._loadTokens.length) {
            return;
        }

        writer.append(" load ");

        for (let i = 0; i < this._loadTokens.length; i++) {
            if (i !== 0) {
                writer.append(", ");
            }

            this._loadTokens[i].writeTo(writer);
        }
    }

    private _buildWhere(writer: StringBuilder) {
        if (!this._whereTokens || !this._whereTokens.length) {
            return;
        }

        writer
            .append(" where ");

        if (this._isIntersect) {
            writer
                .append("intersect(");
        }

        for (let i = 0; i < this._whereTokens.length; i++) {
            DocumentQueryHelper.addSpaceIfNeeded(
                i > 0 ? this._whereTokens[i - 1] : null,
                this._whereTokens[i],
                writer);
            this._whereTokens[i].writeTo(writer);
        }

        if (this._isIntersect) {
            writer.append(") ");
        }
    }

    private _buildGroupBy(writer: StringBuilder): void {
        if (!this._groupByTokens || !this._groupByTokens.length) {
            return;
        }

        writer
            .append(" group by ");

        let isFirst = true;

        for (const token of this._groupByTokens) {
            if (!isFirst) {
                writer.append(", ");
            }

            token.writeTo(writer);
            isFirst = false;
        }
    }

    private _buildFilter(writer: StringBuilder) {
        if (this._filterTokens.length === 0) {
            return;
        }

        writer
            .append(" filter ");

        for (let i = 0; i < this._filterTokens.length; i++) {
            DocumentQueryHelper.addSpaceIfNeeded(i > 0 ? this._filterTokens[i - 1] : null, this._filterTokens[i], writer);
            this._filterTokens[i].writeTo(writer);
        }
    }

    private _buildOrderBy(writer: StringBuilder): void {
        if (!this._orderByTokens || !this._orderByTokens.length) {
            return;
        }

        writer
            .append(" order by ");

        let isFirst = true;

        for (const token of this._orderByTokens) {
            if (!isFirst) {
                writer.append(", ");
            }

            token.writeTo(writer);
            isFirst = false;
        }
    }

    private static _unpackCollection(items: object[]): object[] {
        const results = [];

        for (const item of items) {
            if (Array.isArray(item)) {
                results.push(...AbstractDocumentQuery._unpackCollection(item as any[]));
            } else {
                results.push(item);
            }
        }

        return results;
    }

    // TBD protected Action<BlittableJsonReaderObject> AfterStreamExecutedCallback;

    protected _queryOperation: QueryOperation;

    public queryOperation(): QueryOperation {
        return this._queryOperation;
    }

    // TBD public IDocumentQueryCustomization AfterStreamExecuted(Action<BlittableJsonReaderObject> action)

    public _noTracking(): void {
        this._disableEntitiesTracking = true;
    }

    public _noCaching(): void {
        this._disableCaching = true;
    }

    public _includeTimings(timingsCallback: (timings: QueryTimings) => void): void {
        if (this._queryTimings) {
            timingsCallback(this._queryTimings);
            return;
        }

        this._queryTimings = new QueryTimings();
        timingsCallback(this._queryTimings);
    }

    public _highlight(
        parameters: HighlightingParameters,
        highlightingsCallback: ValueCallback<Highlightings>): void {
        highlightingsCallback(this._queryHighlightings.add(parameters.fieldName));
        const optionsParameterName = parameters
            ? this._addQueryParameter(
                extractHighlightingOptionsFromParameters(parameters))
            : null;
        const token = HighlightingToken.create(
            parameters.fieldName, parameters.fragmentLength, parameters.fragmentCount, optionsParameterName);
        this._highlightingTokens.push(token);
    }

    protected _withinRadiusOf(
        fieldName: string,
        radius: number,
        latitude: number,
        longitude: number,
        radiusUnits: SpatialUnits,
        distErrorPercent: number): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const whereToken = WhereToken.create(
            "SpatialWithin",
            fieldName,
            null,
            new WhereOptions({
                shape: ShapeToken.circle(
                    this._addQueryParameter(radius),
                    this._addQueryParameter(latitude),
                    this._addQueryParameter(longitude), radiusUnits),
                distance: distErrorPercent
            }));
        tokens.push(whereToken);
    }

    protected _spatialByShapeWkt(
        fieldName: string,
        shapeWkt: string,
        relation: SpatialRelation,
        units: SpatialUnits,
        distErrorPercent: number): void {
        fieldName = this._ensureValidFieldName(fieldName, false);

        const tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, fieldName);

        const wktToken = ShapeToken.wkt(this._addQueryParameter(shapeWkt), units);

        let whereOperator: WhereOperator;
        switch (relation) {
            case "Within": {
                whereOperator = "SpatialWithin";
                break;
            }
            case "Contains": {
                whereOperator = "SpatialContains";
                break;
            }
            case "Disjoint": {
                whereOperator = "SpatialDisjoint";
                break;
            }
            case "Intersects": {
                whereOperator = "SpatialIntersects";
                break;
            }
            default: {
                throwError("InvalidArgumentException", `relation: ${relation}.`);
            }
        }

        tokens.push(WhereToken.create(
            whereOperator, fieldName, null, new WhereOptions({
                shape: wktToken,
                distance: distErrorPercent
            })));
    }

    public _spatial(dynamicField: DynamicSpatialField, criteria: SpatialCriteria): void;
    public _spatial(fieldName: string, criteria: SpatialCriteria): void;
    public _spatial(
        fieldNameOrDynamicSpatialField: string | DynamicSpatialField,
        criteria: SpatialCriteria): void {

        let tokens: QueryToken[];
        if (typeof (fieldNameOrDynamicSpatialField) === "string") {
            const fieldName = this._ensureValidFieldName(fieldNameOrDynamicSpatialField, false);

            tokens = this._getCurrentWhereTokens();
            this._appendOperatorIfNeeded(tokens);
            this._negateIfNeeded(tokens, fieldName);

            tokens.push(criteria.toQueryToken(fieldName, (o) => this._addQueryParameter(o)));
            return;
        }

        const dynamicField = fieldNameOrDynamicSpatialField as DynamicSpatialField;
        this._assertIsDynamicQuery(dynamicField, "spatial");

        tokens = this._getCurrentWhereTokens();
        this._appendOperatorIfNeeded(tokens);
        this._negateIfNeeded(tokens, null);

        tokens.push(criteria.toQueryToken(
            dynamicField.toField(
                (fName, isNestedPath) => this._ensureValidFieldName(fName, isNestedPath)),
            (o) => this._addQueryParameter(o)));
    }

    public _orderByDistance(field: DynamicSpatialField, latitude: number, longitude: number): void;
    public _orderByDistance(field: DynamicSpatialField, shapeWkt: string): void;
    public _orderByDistance(fieldName: string, latitude: number, longitude: number): void;
    public _orderByDistance(fieldName: string, latitude: number, longitude: number, roundFactor: number): void;
    public _orderByDistance(fieldName: string, shapeWkt: string): void;
    public _orderByDistance(fieldName: string, shapeWkt: string, roundFactor: number): void;
    public _orderByDistance(
        fieldNameOrField: string | DynamicSpatialField, shapeWktOrLatitude: string | number, longitudeOrRoundFactor?: number, roundFactor?: number): void {

        if (TypeUtil.isString(fieldNameOrField)) {
            if (TypeUtil.isString(shapeWktOrLatitude)) {
                const roundFactorParameterName = longitudeOrRoundFactor ? this._addQueryParameter(longitudeOrRoundFactor) : null;
                this._orderByTokens.push(
                    OrderByToken.createDistanceAscending(
                        fieldNameOrField as string, this._addQueryParameter(shapeWktOrLatitude), roundFactorParameterName));

            } else {
                const roundFactorParameterName = roundFactor ? this._addQueryParameter(roundFactor) : null;
                this._orderByTokens.push(
                    OrderByToken.createDistanceAscending(
                        fieldNameOrField as string,
                        this._addQueryParameter(shapeWktOrLatitude), this._addQueryParameter(longitudeOrRoundFactor), roundFactorParameterName));
            }

            return;
        }

        const field = fieldNameOrField as DynamicSpatialField;
        this._assertIsDynamicQuery(field, "orderByDistance");

        if (!fieldNameOrField) {
            throwError("InvalidArgumentException", "Field cannot be null.");
        }

        if (TypeUtil.isString(shapeWktOrLatitude)) {
            this._orderByDistance(
                "'" + field.toField((f, isNestedPath) =>
                    this._ensureValidFieldName(f, isNestedPath)) + "'", shapeWktOrLatitude as string);
        } else {
            this._orderByDistance(
                "'" + field.toField((f, isNestedPath) =>
                    this._ensureValidFieldName(f, isNestedPath)) + "'", shapeWktOrLatitude as number, longitudeOrRoundFactor, field.roundFactor);
        }
    }

    public _orderByDistanceDescending(field: DynamicSpatialField, latitude: number, longitude: number): void;
    public _orderByDistanceDescending(field: DynamicSpatialField, shapeWkt: string): void;
    public _orderByDistanceDescending(fieldName: string, latitude: number, longitude: number): void;
    public _orderByDistanceDescending(fieldName: string, latitude: number, longitude: number, roundFactor: number): void;
    public _orderByDistanceDescending(fieldName: string, shapeWkt: string): void;
    public _orderByDistanceDescending(fieldName: string, shapeWkt: string, roundFactor: number): void;
    public _orderByDistanceDescending(
        fieldNameOrField: string | DynamicSpatialField, shapeWktOrLatitude: string | number, longitudeOrRoundFactor?: number, roundFactor?: number): void {

        if (TypeUtil.isString(fieldNameOrField)) {
            if (TypeUtil.isString(shapeWktOrLatitude)) {
                const roundFactorParameterName = longitudeOrRoundFactor ? this._addQueryParameter(longitudeOrRoundFactor) : null;
                this._orderByTokens.push(
                    OrderByToken.createDistanceDescending(
                        fieldNameOrField as string, this._addQueryParameter(shapeWktOrLatitude), roundFactorParameterName));
            } else {
                const roundFactorParameterName = roundFactor ? this._addQueryParameter(roundFactor) : null;
                this._orderByTokens.push(
                    OrderByToken.createDistanceDescending(
                        fieldNameOrField as string,
                        this._addQueryParameter(shapeWktOrLatitude), this._addQueryParameter(longitudeOrRoundFactor), roundFactorParameterName));
            }

            return;
        }

        const field = fieldNameOrField as DynamicSpatialField;
        this._assertIsDynamicQuery(field, "orderByDistance");

        if (!fieldNameOrField) {
            throwError("InvalidArgumentException", "Field cannot be null.");
        }

        if (TypeUtil.isString(shapeWktOrLatitude)) {
            this._orderByDistanceDescending(
                "'" + field.toField((f, isNestedPath) =>
                    this._ensureValidFieldName(f, isNestedPath)) + "'", shapeWktOrLatitude as string);
        } else {
            this._orderByDistanceDescending(
                "'" + field.toField((f, isNestedPath) =>
                    this._ensureValidFieldName(f, isNestedPath)) + "'", shapeWktOrLatitude as number, longitudeOrRoundFactor, field.roundFactor);
        }
    }

    private _assertIsDynamicQuery(dynamicField: DynamicSpatialField, methodName: string) {
        if (!this._fromToken.isDynamic) {
            throwError("InvalidOperationException",
                "Cannot execute query method '" + methodName +
                "'. Field '" + dynamicField.toField(this._ensureValidFieldName) +
                "' cannot be used when static index '" +
                this._fromToken.indexName + "' is queried. " +
                "Dynamic spatial fields can only be used with dynamic queries, " +
                " for static index queries please use valid spatial fields defined in index definition.");
        }
    }

    protected _initSync(): Promise<void> {
        if (this._queryOperation) {
            return Promise.resolve();
        }

        this._queryOperation = this.initializeQueryOperation();
        return this._executeActualQuery();
    }

    private async _executeActualQuery(): Promise<void> {
        // TBD 4.1 context = this._queryOperation.enterQueryContext();
        const command = this._queryOperation.createRequest();
        await this._theSession.requestExecutor.execute(command, this._theSession.sessionInfo);
        this._queryOperation.setResult(command.result);
        this.emit("afterQueryExecuted", this._queryOperation.getCurrentQueryResults());
        /* TBD 4.1
        .finally(() => {
            if (context) {
                context.dispose();
            }
        });
        */
    }

    public async iterator(): Promise<IterableIterator<T>> {
        await this._initSync();
        const results = this._queryOperation.complete<T>(this._clazz);
        return results[Symbol.iterator]();
    }

    public async all(): Promise<T[]> {
        const results = await this.iterator();
        return [...results];
    }

    public async getQueryResult(): Promise<QueryResult> {
        await this._initSync();
        return this._queryOperation.getCurrentQueryResults().createSnapshot();
    }

    public async first(): Promise<T> {
        const entries = await this._executeQueryOperation(1);

        if (entries.length === 0) {
            throwError("InvalidOperationException", "Expected at least one result.");
        }

        return entries[0];
    }

    public async firstOrNull(): Promise<T | null> {
        const entries = await this._executeQueryOperation(1);
        return entries[0] || null;
    }

    public async single(): Promise<T> {
        const entries = await this._executeQueryOperation(2);

        if (entries.length !== 1) {
            throwError("InvalidOperationException",
                `Expected single result, but got ${ entries.length ? "more than that" : 0 }.`);
        }

        return entries[0];
    }

    public async singleOrNull(): Promise<T | null> {
        const entries = await this._executeQueryOperation(2);
        if (entries.length === 2) {
            throwError("InvalidOperationException",
                `Expected single result, but got more than that.`);
        }
        return entries.length === 1 ? entries[0] : null;
    }

    public async count(): Promise<number> {
        this._take(0);
        const queryResult = await this.getQueryResult();
        return queryResult.totalResults;
    }

    private async _executeQueryOperation(take?: number): Promise<T[]> {
        await this._executeQueryOperationInternal(take);
        return this.queryOperation().complete(this._clazz);
    }

    private async _executeQueryOperationInternal(take: number) {
        if ((take || take === 0) && (!this._pageSize || this._pageSize > take)) {
            this._take(take);
        }

        await this._initSync();
    }

    public async longCount(): Promise<number> {
        this._take(0);
        const queryResult = await this.getQueryResult();
        return queryResult.longTotalResults;
    }

    public async any(): Promise<boolean> {
        if (this.isDistinct) {
            // for distinct it is cheaper to do count 1
            const result = await this._executeQueryOperation(1);
            return !!result[0];

        }

        this._take(0);
        const queryResult = await this.getQueryResult();
        return queryResult.totalResults > 0;
    }

    public _aggregateBy(facet: FacetBase): void {
        for (const token of this._selectTokens) {
            if (token instanceof FacetToken) {
                continue;
            }
            throwError("InvalidOperationException",
                "Aggregation query can select only facets while it got " + token.constructor.name + " token");
        }
        const facetToken = FacetToken.create(facet, (val) => this._addQueryParameter(val));
        this._selectTokens.push(facetToken);
    }

    public _aggregateUsing(facetSetupDocumentId: string): void {
        this._selectTokens.push(FacetToken.create(facetSetupDocumentId));
    }

    public lazily(): Lazy<T[]> {
        const lazyQueryOperation = this._getLazyQueryOperation();

        return (this._theSession as DocumentSession)
            .addLazyOperation(lazyQueryOperation);
    }

    public countLazily(): Lazy<number> {
        if (!this._queryOperation) {
            this._take(0);
            this._queryOperation = this.initializeQueryOperation();
        }

        const clazz = this._conventions.getJsTypeByDocumentType(this._clazz);
        const lazyQueryOperation =
            new LazyQueryOperation<T>(
                this._theSession,
                this._queryOperation,
                this,
                clazz);
        return (this._theSession as DocumentSession).addLazyCountOperation(lazyQueryOperation);
    }

    public _suggestUsing(suggestion: SuggestionBase) {
        if (!suggestion) {
            throwError("InvalidArgumentException", "suggestion cannot be null");
        }

        this._assertCanSuggest(suggestion);

        let token: SuggestToken = null;

        if (suggestion instanceof SuggestionWithTerm) {
            const term = suggestion;
            token = SuggestToken.create(
                term.field, term.displayField, this._addQueryParameter(term.term), this._getOptionsParameterName(term.options));
        } else if (suggestion instanceof SuggestionWithTerms) {
            const terms = suggestion;
            token = SuggestToken.create(
                terms.field, terms.displayField, this._addQueryParameter(terms.terms), this._getOptionsParameterName(terms.options));
        } else {
            throwError("InvalidOperationException", "Unknown type of suggestion: " + suggestion);
        }

        this._selectTokens.push(token);
    }

    private _getOptionsParameterName(options: SuggestionOptions): string {
        let optionsParameterName = null;

        if (options) {
            optionsParameterName = this._addQueryParameter(options);
        }

        return optionsParameterName;
    }

    private _assertCanSuggest(suggestion: SuggestionBase): void {
        if (this._whereTokens.length) {
            throwError("InvalidOperationException", "Cannot add suggest when WHERE statements are present.");
        }

        if (this._selectTokens.length) {
            const lastToken = this._selectTokens.at(-1);
            if (lastToken instanceof SuggestToken) {
                if (lastToken.fieldName === suggestion.field) {
                    throwError("InvalidOperationException", "Cannot add suggest for the same field again.");
                }
            } else {
                throwError("InvalidOperationException", "Cannot add suggest when SELECT statements are present.");
            }
        }

        if (this._orderByTokens.length) {
            throwError("InvalidOperationException", "Cannot add suggest when ORDER BY statements are present.");
        }
    }

    public _includeExplanations(
        options: ExplanationOptions, explanationsCallback: ValueCallback<Explanations>): void {
       if (this._explanationToken) {
           throwError("InvalidOperationException", "Duplicate IncludeExplanations method calls are forbidden.");
       }

       const optionsParameterName = options
            ? this._addQueryParameter(options)
            : null;
       this._explanationToken = ExplanationToken.create(optionsParameterName);
       this._explanations = new Explanations();

       explanationsCallback(this._explanations);
   }

    protected _timeSeriesIncludesTokens: TimeSeriesIncludesToken[];

    protected _counterIncludesTokens: CounterIncludesToken[];

    protected _compareExchangeValueIncludesTokens: CompareExchangeValueIncludesToken[];

    protected _revisionsIncludesTokens: RevisionIncludesToken[];

    protected _includeCounters(
        alias: string, counterToIncludeByDocId: CountersByDocId): void {
        if (!counterToIncludeByDocId || !counterToIncludeByDocId.size) {
            return;
        }
        this._counterIncludesTokens = [];
        this._includesAlias = alias;

        for (const [ key, val ] of counterToIncludeByDocId.entries()) {
            if (val[0]) {
                this._counterIncludesTokens.push(CounterIncludesToken.all(key));
                continue;
            }

            const valArr = [...val[1]];
            if (!valArr || !valArr.length) {
                continue;
            }

            for (const name of val[1]) {
                this._counterIncludesTokens.push(CounterIncludesToken.create(key, name));
            }
        }
    }

    private _includeTimeSeries(alias: string, timeSeriesToInclude: Map<string, AbstractTimeSeriesRange[]>) {
        if (!timeSeriesToInclude || !timeSeriesToInclude.size) {
            return;
        }

        this._timeSeriesIncludesTokens = [];
        if (!this._includesAlias) {
            this._includesAlias = alias;
        }

        for (const kvp of timeSeriesToInclude.entries()) {
            for (const range of kvp[1].values()) {
                this._timeSeriesIncludesTokens.push(TimeSeriesIncludesToken.create(kvp[0], range));
            }
        }
    }

    public getQueryType(): DocumentType<T> {
        return this._clazz;
    }

    public addFromAliasToWhereTokens(fromAlias: string): void {
        const tokens = this._getCurrentWhereTokens();
        this._addFromAliasToTokens(fromAlias, tokens);
    }

    public addFromAliasToOrderByTokens(fromAlias: string) {
        const tokens = this._getCurrentOrderByTokens();
        this._addFromAliasToTokens(fromAlias, tokens);
    }

    addFromAliasToFilterTokens(fromAlias: string) {
        const tokens = this._getCurrentFilterTokens();
        this._addFromAliasToTokens(fromAlias, tokens);
    }

    private _addFromAliasToTokens(fromAlias: string, tokens: QueryToken[]): void {
        if (!fromAlias) {
            throwError("InvalidArgumentException", "Alias cannot be null or empty.");
        }

        for (const token of tokens) {
            if (token instanceof WhereToken) {
                token.addAlias(fromAlias);
            }
            if (token instanceof OrderByToken) {
                token.addAlias(fromAlias);
            }
        }
    }

     public addAliasToIncludesTokens(fromAlias: string): string {
        if (!this._includesAlias) {
            return fromAlias;
        }

        if (!fromAlias) {
            fromAlias = this._includesAlias;
            this.addFromAliasToWhereTokens(fromAlias);
        }

        if (this._counterIncludesTokens) {
            for (const counterIncludesToken of this._counterIncludesTokens) {
                counterIncludesToken.addAliasToPath(fromAlias);
            }
        }

        if (this._timeSeriesIncludesTokens) {
            for (const token of this._timeSeriesIncludesTokens) {
                token.addAliasToPath(fromAlias);
            }
        }

        return fromAlias;
    }

    private _includeRevisionsByDate(dateTime: Date) {
        if (!this._revisionsIncludesTokens) {
            this._revisionsIncludesTokens = [];
        }

        this._revisionsIncludesTokens.push(RevisionIncludesToken.createForDate(dateTime));
    }

    private _includeRevisionsByChangeVector(revisionsToIncludeByChangeVector: Set<string>) {
        if (!this._revisionsIncludesTokens) {
            this._revisionsIncludesTokens = [];
        }

        for (const changeVector of revisionsToIncludeByChangeVector) {
            this._revisionsIncludesTokens.push(RevisionIncludesToken.createForPath(changeVector));
        }
    }

    public get parameterPrefix() {
        return this._parameterPrefix;
    }

    public set parameterPrefix(prefix: string) {
        this._parameterPrefix = prefix;
    }
}


class FilterModeScope implements IDisposable {
    private readonly _modeStack: boolean[];

    public constructor(modeStack: boolean[], on: boolean) {
        this._modeStack = modeStack;
        this._modeStack.push(on);
    }

    public dispose(): void {
        this._modeStack.pop();
    }
}

