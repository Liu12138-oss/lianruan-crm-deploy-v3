const Database = require('better-sqlite3');

class AuditDb {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.sqlite = new Database(dbPath, {
      verbose: options.verbose ? (msg) => console.log('[AUDIT SQL]', msg) : undefined,
    });

    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');

    this._initSchema();
    this._initStatements();

    console.log(`[AuditDb] SQLite database opened: ${dbPath}`);
  }

  _initSchema() {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        request_id TEXT,
        actor_user_id TEXT,
        actor_username TEXT,
        actor_name TEXT,
        actor_role TEXT,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        target_name TEXT,
        result TEXT NOT NULL,
        message TEXT,
        ip TEXT,
        user_agent TEXT,
        before_json TEXT,
        after_json TEXT,
        extra_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
        ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action
        ON audit_logs(module, action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target
        ON audit_logs(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
        ON audit_logs(actor_user_id, created_at DESC);
    `);
  }

  _initStatements() {
    this._stmt = {
      insert: this.sqlite.prepare(`
        INSERT INTO audit_logs (
          id,
          created_at,
          request_id,
          actor_user_id,
          actor_username,
          actor_name,
          actor_role,
          module,
          action,
          target_type,
          target_id,
          target_name,
          result,
          message,
          ip,
          user_agent,
          before_json,
          after_json,
          extra_json
        ) VALUES (
          @id,
          @created_at,
          @request_id,
          @actor_user_id,
          @actor_username,
          @actor_name,
          @actor_role,
          @module,
          @action,
          @target_type,
          @target_id,
          @target_name,
          @result,
          @message,
          @ip,
          @user_agent,
          @before_json,
          @after_json,
          @extra_json
        )
      `),
      getById: this.sqlite.prepare(`
        SELECT *
        FROM audit_logs
        WHERE id = ?
      `),
    };
  }

  insert(entry) {
    this._stmt.insert.run(entry);
    return entry;
  }

  getById(id) {
    return this._stmt.getById.get(id) || null;
  }

  list(filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const whereParts = [];
    const params = {};

    const exactFilters = [
      ['module', 'module'],
      ['action', 'action'],
      ['result', 'result'],
      ['actorUserId', 'actor_user_id'],
      ['targetType', 'target_type'],
      ['targetId', 'target_id'],
    ];

    for (const [key, column] of exactFilters) {
      if (filters[key]) {
        whereParts.push(`${column} = @${key}`);
        params[key] = String(filters[key]).trim();
      }
    }

    if (filters.dateFrom) {
      whereParts.push('created_at >= @dateFrom');
      params.dateFrom = String(filters.dateFrom).trim();
    }
    if (filters.dateTo) {
      whereParts.push('created_at <= @dateTo');
      params.dateTo = String(filters.dateTo).trim();
    }
    if (filters.keyword) {
      whereParts.push(`(
        COALESCE(actor_username, '') LIKE @keyword OR
        COALESCE(actor_name, '') LIKE @keyword OR
        COALESCE(target_name, '') LIKE @keyword OR
        COALESCE(target_id, '') LIKE @keyword OR
        COALESCE(message, '') LIKE @keyword
      )`);
      params.keyword = `%${String(filters.keyword).trim()}%`;
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const countRow = this.sqlite.prepare(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      ${whereSql}
    `).get(params);

    const data = this.sqlite.prepare(`
      SELECT
        id,
        created_at,
        request_id,
        actor_user_id,
        actor_username,
        actor_name,
        actor_role,
        module,
        action,
        target_type,
        target_id,
        target_name,
        result,
        message,
        ip,
        user_agent
      FROM audit_logs
      ${whereSql}
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT @pageSize OFFSET @offset
    `).all({
      ...params,
      pageSize,
      offset,
    });

    return {
      page,
      pageSize,
      total: countRow?.total || 0,
      data,
    };
  }

  close() {
    try {
      this.sqlite.close();
      console.log('[AuditDb] SQLite database closed');
    } catch (err) {
      console.error('[AuditDb] Failed to close SQLite database:', err.message);
    }
  }
}

module.exports = AuditDb;
