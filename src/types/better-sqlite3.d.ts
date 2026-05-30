declare module 'better-sqlite3' {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Array<Record<string, unknown>>;
  }

  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    pragma(value: string): unknown;
    close(): void;
  }

  interface DatabaseConstructor {
    new(path: string): Database;
    (path: string): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}
