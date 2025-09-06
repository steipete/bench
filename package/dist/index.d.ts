import { Dialect, PostgresAdapter, Driver, Kysely, DatabaseIntrospector, QueryCompiler, DatabaseConnection, TransactionSettings } from 'kysely';

interface NeonDialectConfig {
    neon: NeonClient | (() => NeonClient | Promise<NeonClient>);
}
interface NeonClient {
    query: (queryWithPlaceholders: string, params?: any[] | undefined, queryOpts?: NeonQueryOptions | undefined) => Promise<any>;
}
interface NeonQueryOptions {
    arrayMode?: boolean;
    fullResults?: boolean;
}

declare class NeonDialect implements Dialect {
    #private;
    constructor(config: NeonDialectConfig);
    createAdapter(): PostgresAdapter;
    createDriver(): Driver;
    createIntrospector(db: Kysely<any>): DatabaseIntrospector;
    createQueryCompiler(): QueryCompiler;
}

declare class NeonDriver implements Driver {
    #private;
    constructor(config: NeonDialectConfig);
    acquireConnection(): Promise<DatabaseConnection>;
    beginTransaction(_connection: DatabaseConnection, _settings: TransactionSettings): Promise<void>;
    commitTransaction(_connection: DatabaseConnection): Promise<void>;
    destroy(): Promise<void>;
    init(): Promise<void>;
    releaseConnection(_connection: DatabaseConnection): Promise<void>;
    rollbackTransaction(_connection: DatabaseConnection): Promise<void>;
}

export { NeonDialect, type NeonDialectConfig, NeonDriver };
