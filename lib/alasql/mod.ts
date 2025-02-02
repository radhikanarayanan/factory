import { alaSQL } from "./deps.ts";
import * as sqlite from "../sqlite/mod.ts";
import * as govn from "../sql/governance.ts";

// TODO: we haven't properly "typed" alaSQL yet
// deno-lint-ignore no-explicit-any
export type AlaSqlEngine = any;

// nomenclature and conventions should follow PgDCP whenever possible

export interface AlaSqlProxyInit<DBEE extends govn.SqlEventEmitter> {
  readonly events: (db: AlaSqlProxy<DBEE>) => DBEE;
  readonly statements?: (
    filter?: (e: govn.SqlStatement) => boolean,
  ) => Iterable<govn.SqlStatement>;
}

export interface AlaSqlProxyContext
  extends
    govn.SqlInstanceContext,
    govn.SqlDefineConnContext,
    govn.SqlWriteConnContext,
    govn.SqlReadConnContext,
    govn.DbmsInventoryContext {
  readonly alaSqlPrimeDB: AlaSqlEngine;
}

export class AlaSqlProxy<
  DBEE extends govn.SqlEventEmitter = govn.SqlEventEmitter,
> implements AlaSqlProxyContext, govn.DbmsEngine {
  #initialized = false;
  readonly identity = "alaSqlEngine";
  // deno-lint-ignore no-explicit-any
  readonly alaSqlEngine: any; // the alaSQL.default instance
  readonly alaSqlPrimeDB: AlaSqlEngine; // the alaSQL primary database instance
  readonly dbee: DBEE;
  readonly defnTxLog: Record<string, unknown>[] = [];
  readonly statements?: (
    filter?: (e: govn.SqlStatement) => boolean,
  ) => Iterable<govn.SqlStatement>;

  constructor(init: AlaSqlProxyInit<DBEE>) {
    this.alaSqlEngine = alaSQL.default;
    this.alaSqlPrimeDB = new alaSQL.default.Database("prime");
    this.dbee = init.events(this);
    this.statements = init.statements;
  }

  inventoryTable() {
    const rows: { db_name: string; table_name: string; column_name: string }[] =
      [];
    for (const db of this.databases()) {
      if (!db.isSchemaDatabase) {
        for (const table of db.tables()) {
          for (const column of table.columns()) {
            rows.push({
              db_name: db.identity,
              table_name: table.identity,
              column_name: column.identity,
            });
          }
        }
      }
    }
    return rows;
  }

  databases(filter?: (e: govn.DbmsEngineDatabase) => boolean) {
    const databases: govn.DbmsEngineDatabase[] = [];
    for (const dbRow of this.alaSqlEngine.exec("SHOW DATABASES")) {
      const databaseID = dbRow.databaseid;
      const tables = (filter?: (t: govn.DbmsTable) => boolean) => {
        const tables: govn.DbmsTable[] = [];
        for (
          const tRow of this.alaSqlEngine.exec(`SHOW TABLES from ${databaseID}`)
        ) {
          const tableID = tRow.tableid;
          const columns = (filter?: (t: govn.DbmsTableColumn) => boolean) => {
            const columns: govn.DbmsTableColumn[] = [];
            for (
              const cRow of this.alaSqlEngine.exec(
                `SHOW COLUMNS from ${tableID} from ${databaseID}`,
              )
            ) {
              const columnID = cRow.columnid;
              const dataType = cRow.dbtypeid;
              const column: govn.DbmsTableColumn = {
                identity: columnID,
                nature: dataType ? { identity: dataType } : undefined,
              };
              if (!filter || filter(column)) {
                columns.push(column);
              }
            }
            return columns;
          };
          const table: govn.DbmsTable = {
            identity: tableID,
            columns,
          };
          if (!filter || filter(tRow)) {
            tables.push(table);
          }
        }
        return tables;
      };
      const db: govn.DbmsEngineSchemalessDatabase = {
        isSchemaDatabase: false,
        identity: databaseID,
        tables,
      };
      if (!filter || filter(db)) {
        databases.push(db);
      }
    }
    return databases;
  }

  engines() {
    const databases = (filter?: (db: govn.DbmsEngineDatabase) => boolean) => {
      return this.databases(filter);
    };
    return [{
      identity: this.identity,
      databases,
    }];
  }

  get initialized() {
    return this.#initialized;
  }

  async init() {
    if (this.#initialized) return;

    await this.dbee.emit("openingDatabase", this);

    this.dbee.on("openedDatabase", async () => {
      await this.dbee.emit("constructStorage", this);
      await this.dbee.emit("constructIdempotent", this);
      await this.dbee.emit("populateSeedData", this);
    });

    await this.dbee.emit("openedDatabase", this);
    this.#initialized = true;
  }

  close() {
    this.dbee.emitSync("closingDatabase", this);
    this.dbee.emitSync("closedDatabase", this);
  }

  rowsDDL<Row extends govn.SqlRow>(
    SQL: string,
    params?: govn.SqlQueryParameterSet | undefined,
  ): govn.QueryExecutionRowsSupplier<Row> {
    const rows = this.alaSqlPrimeDB.exec(SQL, params);
    const result: govn.QueryExecutionRowsSupplier<Row> = { rows, SQL, params };
    this.dbee.emit("executedDDL", result);
    return result;
  }

  rowsDML<Row extends govn.SqlRow>(
    SQL: string,
    params?: govn.SqlQueryParameterSet | undefined,
  ): govn.QueryExecutionRowsSupplier<Row> {
    const rows = this.alaSqlPrimeDB.exec(SQL, params);
    const result: govn.QueryExecutionRowsSupplier<Row> = { rows, SQL, params };
    this.dbee.emit("executedDML", result);
    return result;
  }

  jsDDL(
    tableName: string,
    columnDefns: Iterable<string>,
  ): string {
    return `CREATE TABLE ${tableName} (\n ${
      // use [colName] so that reserved SQL keywords can be used as column name
      Array.from(columnDefns).map((colName) => `[${colName}]`).join(",\n ")
    })`;
  }

  // deno-lint-ignore ban-types
  jsObjectDDL<TableRow extends object = object>(
    tableName: string,
    inspectable: TableRow,
    options?: {
      valueSqlTypeMap?: (value: unknown) => string | undefined;
      prepareTxLogEntry?: (
        suggested: Record<string, unknown>,
        inspected: TableRow | Record<string, unknown>,
      ) => Record<string, unknown>;
    },
  ): { DDL?: string; txLogEntry: Record<string, unknown> } {
    const { valueSqlTypeMap, prepareTxLogEntry } = options ?? {};

    const columnDefns = [];
    for (const entry of Object.entries(inspectable)) {
      const [name, value] = entry;
      columnDefns.push(
        valueSqlTypeMap ? `${name} ${valueSqlTypeMap(value)}` : name,
      );
    }
    const DDL = this.jsDDL(tableName, columnDefns);
    // inspected may be large so we don't add it to the log by default
    const txLogEntry: Record<string, unknown> = { DDL, tableName, columnDefns };
    return {
      DDL,
      txLogEntry: prepareTxLogEntry
        ? prepareTxLogEntry(txLogEntry, inspectable)
        : txLogEntry,
    };
  }

  // deno-lint-ignore ban-types
  createJsObjectSingleRowTable<TableRow extends object = object>(
    tableName: string,
    tableRow: TableRow,
    database = this.alaSqlPrimeDB,
    options?: {
      valueSqlTypeMap?: (value: unknown) => string | undefined;
      prepareTxLogEntry?: (
        suggested: Record<string, unknown>,
        inspected: TableRow | Record<string, unknown>,
      ) => Record<string, unknown>;
    },
  ) {
    const defn = this.jsObjectDDL(tableName, tableRow, options);
    if (defn.DDL) {
      try {
        database.exec(defn.DDL);
        database.tables[tableName].data = [tableRow];
        this.defnTxLog.push(defn.txLogEntry);
      } catch (error) {
        this.defnTxLog.push({
          origin: "createJsObjectSingleRowTable",
          error: error.toString(),
          ...defn.txLogEntry,
        });
      }
      return defn;
    }
  }

  // deno-lint-ignore ban-types
  createJsObjectsTable<TableRow extends object = object>(
    tableName: string,
    tableRows?: Array<TableRow>,
    database = this.alaSqlPrimeDB,
    options?: {
      structureSupplier?: (rows?: Array<TableRow>) => TableRow | undefined;
      valueSqlTypeMap?: (value: unknown) => string | undefined;
      prepareTxLogEntry?: (
        suggested: Record<string, unknown>,
      ) => Record<string, unknown>;
    },
  ) {
    // every row is the same structure, so inspect just the first to detect structure
    // deno-lint-ignore ban-types
    const inspectFirstRow = (rows?: object[]) => {
      return rows ? (rows.length > 0 ? rows[0] : undefined) : undefined;
    };

    const { structureSupplier = inspectFirstRow, prepareTxLogEntry } =
      options ?? {};
    const inspectable = structureSupplier(tableRows);
    const tableRowsCount = tableRows ? tableRows.length : undefined;
    const origin = "createJsObjectsTable";
    if (inspectable) {
      const defn = this.jsObjectDDL(tableName, inspectable, {
        prepareTxLogEntry: (suggested) => {
          const result = { ...suggested, tableRowsCount };
          return prepareTxLogEntry ? prepareTxLogEntry(result) : result;
        },
        valueSqlTypeMap: options?.valueSqlTypeMap,
      });
      if (defn.DDL) {
        try {
          database.exec(defn.DDL);
          if (tableRows) database.tables[tableName].data = tableRows;
          this.defnTxLog.push(defn.txLogEntry);
        } catch (error) {
          this.defnTxLog.push({
            origin,
            error: error.toString(),
            ...defn.txLogEntry,
          });
        }
        return defn;
      }
    } else {
      const txLogEntry = {
        origin,
        error: `no inspectable object supplied, ${tableName} not created`,
        tableName,
        tableRowsCount,
      };
      this.defnTxLog.push(
        prepareTxLogEntry ? prepareTxLogEntry(txLogEntry) : txLogEntry,
      );
    }
  }

  createJsFlexibleTable(
    tableName: string,
    // deno-lint-ignore ban-types
    tableRows?: Array<object>,
    database = this.alaSqlPrimeDB,
  ) {
    const tableRowsCount = tableRows ? tableRows.length : undefined;
    const origin = "createJsFlexibleTable";
    if (tableRows) {
      // each row might have different columns so find the set of all columns
      // across all rows and create a "flexible table"
      const columnDefns = new Map<string, { foundInRows: number }>();
      for (const row of tableRows) {
        for (const entry of Object.entries(row)) {
          const [name] = entry;
          const found = columnDefns.get(name);
          if (found) found.foundInRows++;
          else columnDefns.set(name, { foundInRows: 1 });
        }
      }
      const DDL = this.jsDDL(tableName, columnDefns.keys());
      const txLogEntry = {
        DDL,
        tableName,
        tableRowsCount,
        columnDefns: Object.fromEntries(columnDefns),
      };
      try {
        database.exec(DDL);
        if (tableRows) database.tables[tableName].data = tableRows;
        this.defnTxLog.push(txLogEntry);
      } catch (error) {
        this.defnTxLog.push({
          origin,
          error: error.toString(),
          ...txLogEntry,
        });
      }
    } else {
      this.defnTxLog.push({
        origin,
        error: `no tableRows supplied, ${tableName} not created`,
        tableName,
        tableRowsCount,
      });
    }
  }

  importSqliteDB(
    sqliteDb: sqlite.SqliteDatabase,
    alaSqlDbSupplier: (sqliteDb: sqlite.SqliteDatabase) => AlaSqlEngine,
  ) {
    const alaSqlDB = alaSqlDbSupplier(sqliteDb);
    const tables = sqliteDb.dbStore.query<[tableName: string]>(
      "SELECT name from sqlite_master where type = 'table' and name != 'sqlite_sequence'",
    );
    for (const table of tables) {
      const [tableName] = table;
      const rows = sqliteDb.recordsDQL(`SELECT * FROM ${tableName}`);
      if (rows) {
        this.createJsObjectsTable(tableName, rows.records, alaSqlDB, {
          prepareTxLogEntry: (suggested) => ({
            ...suggested,
            origin: "importSqliteDB",
            originSqlLiteDbStoreFsPath: sqliteDb.dbStoreFsPath,
          }),
        });
      }
    }
  }

  rowsDQL<Row extends govn.SqlRow>(
    SQL: string,
    params?: govn.SqlQueryParameterSet | undefined,
  ): govn.QueryExecutionRowsSupplier<Row> {
    // TODO: add check to make sure "SELECT MATRIX is used"
    const rows = this.alaSqlPrimeDB.exec(SQL, params);
    const result: govn.QueryExecutionRowsSupplier<Row> = { rows, SQL, params };
    this.dbee.emit("executedDQL", result);
    return result;
  }

  recordsDQL<Object extends govn.SqlRecord>(
    SQL: string,
    params?: govn.SqlQueryParameterSet | undefined,
  ): govn.QueryExecutionRecordsSupplier<Object> {
    const records = this.alaSqlPrimeDB.exec(SQL, params);
    const result: govn.QueryExecutionRecordsSupplier<Object> = {
      records,
      SQL,
      params,
    };
    this.dbee.emit("executedDQL", result);
    return result;
  }

  firstRecordDQL<Object extends govn.SqlRecord>(
    SQL: string,
    params?: govn.SqlQueryParameterSet | undefined,
    options?: {
      readonly enhance?: (record: Record<string, unknown>) => Object;
      readonly onNotFound?: () => Object | undefined;
      readonly autoLimitSQL?: (SQL: string) => string;
    },
  ): Object | undefined {
    // TODO: add check to make sure "SELECT ROW"
    const { autoLimitSQL = (() => `${SQL} LIMIT 1`) } = options ?? {};
    const selected = this.recordsDQL<Object>(autoLimitSQL(SQL), params);
    if (selected.records.length > 0) {
      const record = selected.records[0];
      if (options?.enhance) return options.enhance(record);
      return record;
    }
    return options?.onNotFound ? options.onNotFound() : undefined;
  }
}
