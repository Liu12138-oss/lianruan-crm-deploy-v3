/**
 * 联软CRM - SQLite 持久化层
 * 混合架构：内存缓存 + SQLite 写入
 *
 * 设计原则：
 * - 内存中的 db 对象保持不变，业务逻辑零修改
 * - 每次 saveData() 调用改为同步写入 SQLite（事务保证原子性）
 * - 启动时从 SQLite 加载数据到内存
 * - WAL 模式确保并发安全 + 崩溃恢复
 * - 移除 setInterval 定时保存（SQLite 即时写入已保证持久性）
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 所有实体名称（与 server.js 中 db 对象的键名保持一致）
const ENTITY_NAMES = [
  'users',
  'partners',
  'registrations',
  'opportunities',
  'notifications',
  'quotes',
  'orders',
  'channelTargets',
  'channelVisits',
  'pendingApprovals',
  'categories',
  'modules',
  'features',
  'hardwareProducts',
  'packages',
  'products',
  'partnerProfiles',
  'partnerProfileProducts',
  'openApiClients',
  'implementationWorkloadClassifications',
  'implementationWorkloadMappings',
  'implementationWorkloadRules',
  'implementationDeliveryWorkloadRules',
];

class DbLayer {
  /**
   * @param {string} dbPath - SQLite 数据库文件路径（如 /path/to/crm.db）
   * @param {object} [options] - 可选配置
   * @param {boolean} [options.verbose] - 是否打印 SQL 日志
   */
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.sqlite = new Database(dbPath, {
      verbose: options.verbose ? (msg) => console.log('[SQL]', msg) : undefined,
    });

    // WAL 模式：并发读写不阻塞
    this.sqlite.pragma('journal_mode = WAL');
    // NORMAL 模式：性能与安全的平衡（WAL 下已足够安全）
    this.sqlite.pragma('synchronous = NORMAL');
    // 外键约束（未来扩展用）
    this.sqlite.pragma('foreign_keys = ON');

    this._initSchema();
    this._initStatements();

    console.log(`[DbLayer] SQLite 数据库已打开: ${dbPath}`);
  }

  /**
   * 初始化数据库表结构
   * 采用通用实体表设计：每个实体记录存为 JSON blob
   * 优点：无需为每个实体建独立表，嵌套数据结构零损耗
   */
  _initSchema() {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        entity_name  TEXT    NOT NULL,
        id           TEXT    NOT NULL,
        data_json    TEXT    NOT NULL,
        updated_at   TEXT    DEFAULT (datetime('now')),
        PRIMARY KEY (entity_name, id)
      );
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(entity_name);
    `);

    // 版本追踪表（用于后续 schema 迁移）
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version     INTEGER PRIMARY KEY,
        applied_at  TEXT    DEFAULT (datetime('now')),
        description TEXT
      );
    `);

    const row = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM schema_version').get();
    if (row.cnt === 0) {
      this.sqlite.prepare(
        "INSERT INTO schema_version (version, description) VALUES (1, '初始版本 - 通用实体表')"
      ).run();
    }
  }

  /**
   * 预编译 SQL 语句（better-sqlite3 最佳实践，避免重复解析）
   */
  _initStatements() {
    this._stmt = {
      upsert: this.sqlite.prepare(`
        INSERT INTO entities (entity_name, id, data_json, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(entity_name, id) DO UPDATE SET
          data_json  = excluded.data_json,
          updated_at = excluded.updated_at
      `),

      getByEntity: this.sqlite.prepare(
        'SELECT id, data_json FROM entities WHERE entity_name = ? ORDER BY rowid'
      ),

      getById: this.sqlite.prepare(
        'SELECT data_json FROM entities WHERE entity_name = ? AND id = ?'
      ),

      deleteByEntityAndId: this.sqlite.prepare(
        'DELETE FROM entities WHERE entity_name = ? AND id = ?'
      ),

      deleteByEntityNotIn: null, // 动态构建（IN 子句长度不固定）

      countByEntity: this.sqlite.prepare(
        'SELECT COUNT(*) as cnt FROM entities WHERE entity_name = ?'
      ),
    };
  }

  /**
   * 从 SQLite 加载所有数据到内存对象
   * @returns {object} - 与原 db 对象结构一致的 JS 对象
   */
  loadAll() {
    const result = {};
    for (const entityName of ENTITY_NAMES) {
      result[entityName] = [];
    }

    const rows = this.sqlite.prepare('SELECT entity_name, data_json FROM entities').all();
    for (const row of rows) {
      if (!result[row.entity_name]) {
        console.warn(`[DbLayer] 未知实体类型: ${row.entity_name}，已忽略`);
        continue;
      }
      try {
        result[row.entity_name].push(JSON.parse(row.data_json));
      } catch (e) {
        console.error(`[DbLayer] 解析 ${row.entity_name} 数据失败:`, e.message);
      }
    }

    // 统计信息
    const stats = ENTITY_NAMES.map((name) => `${name}=${result[name].length}`).join(', ');
    console.log(`[DbLayer] 数据加载完成: ${stats}`);

    return result;
  }

  /**
   * 将内存中的 db 对象同步写入 SQLite（原子事务）
   * 这是 saveData() 的替代实现
   *
   * 策略：upsert 所有内存记录 + 删除 SQLite 中多余记录
   * @param {object} db - 内存中的 db 对象
   */
  syncToDb(db) {
    const transaction = this.sqlite.transaction(() => {
      for (const entityName of ENTITY_NAMES) {
        const items = db[entityName] || [];
        const memoryIds = new Set();

        // 1. upsert 所有内存记录
        for (const item of items) {
          if (item && item.id) {
            this._stmt.upsert.run(entityName, String(item.id), JSON.stringify(item));
            memoryIds.add(String(item.id));
          }
        }

        // 2. 删除 SQLite 中存在但内存中不存在的记录（已被删除的）
        if (memoryIds.size > 0) {
          const placeholders = Array.from(memoryIds, () => '?').join(',');
          this.sqlite.prepare(
            `DELETE FROM entities WHERE entity_name = ? AND id NOT IN (${placeholders})`
          ).run(entityName, ...memoryIds);
        } else {
          // 内存中该实体为空，清空 SQLite 中对应记录
          this.sqlite.prepare(
            'DELETE FROM entities WHERE entity_name = ?'
          ).run(entityName);
        }
      }
    });

    try {
      transaction();
    } catch (err) {
      console.error('[DbLayer] 同步到数据库失败:', err.message);
      throw err; // 向上抛出，让调用方知道
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    try {
      this.sqlite.close();
      console.log('[DbLayer] SQLite 数据库已安全关闭');
    } catch (err) {
      console.error('[DbLayer] 关闭数据库失败:', err.message);
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    const stats = {};
    for (const entityName of ENTITY_NAMES) {
      const row = this._stmt.countByEntity.get(entityName);
      stats[entityName] = row.cnt;
    }
    return stats;
  }

  /**
   * 检查数据库是否为空（首次运行判断）
   * @returns {boolean}
   */
  isEmpty() {
    const row = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM entities').get();
    return row.cnt === 0;
  }

  /**
   * 从 JSON 文件导入数据到 SQLite（用于迁移）
   * @param {string} jsonPath - data.json 文件路径
   * @param {object} [keyMapping] - 键名映射，如 { hardware: 'hardwareProducts' }
   */
  importFromJson(jsonPath, keyMapping = {}) {
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON 文件不存在: ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    const transaction = this.sqlite.transaction(() => {
      for (const entityName of ENTITY_NAMES) {
        // 支持键名映射（如 data.json 中 hardware → 内存中 hardwareProducts）
        const jsonKey = keyMapping[entityName] || entityName;
        const items = data[jsonKey] || data[entityName] || [];

        for (const item of items) {
          if (item && item.id) {
            this._stmt.upsert.run(entityName, String(item.id), JSON.stringify(item));
          }
        }
      }
    });

    transaction();
    console.log(`[DbLayer] 从 ${jsonPath} 导入数据完成`);
  }

  /**
   * 备份数据库到 JSON 文件（兼容旧版本回退）
   * @param {string} jsonPath - 输出 JSON 文件路径
   * @param {object} db - 内存中的 db 对象
   */
  exportToJson(jsonPath, db) {
    // 兼容旧版：hardwareProducts 在 data.json 中也写成 hardwareProducts
    const output = {};
    for (const entityName of ENTITY_NAMES) {
      output[entityName] = db[entityName] || [];
    }
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[DbLayer] 数据已备份到 ${jsonPath}`);
  }
}

module.exports = DbLayer;
