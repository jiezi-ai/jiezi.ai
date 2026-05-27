import { Database } from "bun:sqlite";

/**
 * D1-compatible wrapper around bun:sqlite.
 * Matches the D1Database.prepare().bind().all/first/run() API
 * so route code needs zero changes.
 */
export class SqliteDatabase {
  constructor(private db: Database) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this.db, sql);
  }
}

class SqliteStatement {
  private params: any[] = [];

  constructor(
    private db: Database,
    private sql: string,
  ) {}

  bind(...params: any[]): SqliteStatement {
    this.params = params;
    return this;
  }

  all(): { results: any[] } {
    const stmt = this.db.prepare(this.sql);
    const results = this.params.length > 0 ? stmt.all(...this.params) : stmt.all();
    return { results };
  }

  first(): any {
    const stmt = this.db.prepare(this.sql);
    return this.params.length > 0 ? stmt.get(...this.params) : stmt.get();
  }

  run(): void {
    const stmt = this.db.prepare(this.sql);
    if (this.params.length > 0) {
      stmt.run(...this.params);
    } else {
      stmt.run();
    }
  }
}
