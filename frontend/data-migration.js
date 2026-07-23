// ============================================================
// 数据迁移模块 - 确保版本升级时数据平滑过渡
// ============================================================

const DataMigration = {
  // 当前应用版本（在 app.js 中定义）
  APP_VERSION: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '2.0.0',
  
  // 当前数据结构版本
  DATA_VERSION: '2',
  
  // 支持的数据版本列表
  SUPPORTED_VERSIONS: ['1', '2'],
  
  // 存储键名前缀
  STORAGE_PREFIX: 'lianruan_',
  
  // 初始化并执行迁移
  async init() {
    console.log('[DataMigration] 初始化...');
    
    const currentVersion = this.getCurrentDataVersion();
    const targetVersion = this.DATA_VERSION;
    
    if (currentVersion === targetVersion) {
      console.log('[DataMigration] 数据版本已是最新');
      return;
    }
    
    console.log(`[DataMigration] 需要迁移: v${currentVersion} -> v${targetVersion}`);
    
    try {
      // 创建备份
      this.createBackup(currentVersion);
      
      // 执行迁移链
      await this.runMigrationChain(currentVersion, targetVersion);
      
      // 更新版本标记
      this.setDataVersion(targetVersion);
      
      console.log('[DataMigration] 迁移完成');
      
      // 显示迁移成功提示
      if (typeof ElementPlus !== 'undefined') {
        ElementPlus.ElMessage.success('数据已自动更新至最新版本');
      }
    } catch (error) {
      console.error('[DataMigration] 迁移失败:', error);
      
      // 尝试回滚
      this.rollback(currentVersion);
      
      throw new Error(`数据迁移失败: ${error.message}`);
    }
  },
  
  // 获取当前数据版本
  getCurrentDataVersion() {
    return localStorage.getItem(`${this.STORAGE_PREFIX}data_version`) || '1';
  },
  
  // 设置数据版本
  setDataVersion(version) {
    localStorage.setItem(`${this.STORAGE_PREFIX}data_version`, version);
    localStorage.setItem(`${this.STORAGE_PREFIX}app_version`, this.APP_VERSION);
    localStorage.setItem(`${this.STORAGE_PREFIX}last_update`, new Date().toISOString());
  },
  
  // 创建备份
  createBackup(version) {
    const timestamp = Date.now();
    const backupKey = `${this.STORAGE_PREFIX}backup_v${version}_${timestamp}`;
    
    const dataKeys = [
      `${this.STORAGE_PREFIX}data_v${version}`,
      `${this.STORAGE_PREFIX}user_v${version}`,
      `${this.STORAGE_PREFIX}config_v${version}`
    ];
    
    const backup = {};
    dataKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) backup[key] = value;
    });
    
    if (Object.keys(backup).length > 0) {
      localStorage.setItem(backupKey, JSON.stringify(backup));
      console.log(`[DataMigration] 备份创建: ${backupKey}`);
      
      // 清理旧备份（保留最近10个）
      this.cleanupOldBackups(version);
    }
  },
  
  // 清理旧备份
  cleanupOldBackups(version) {
    const prefix = `${this.STORAGE_PREFIX}backup_v${version}_`;
    const backups = Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .sort();
    
    // 保留最近10个备份
    if (backups.length > 10) {
      backups.slice(0, backups.length - 10).forEach(key => {
        localStorage.removeItem(key);
        console.log(`[DataMigration] 清理旧备份: ${key}`);
      });
    }
  },
  
  // 执行迁移链
  async runMigrationChain(fromVersion, toVersion) {
    let current = fromVersion;
    
    while (current < toVersion) {
      const next = String(Number(current) + 1);
      const migrationMethod = `migrate_${current}_to_${next}`;
      
      if (typeof this[migrationMethod] === 'function') {
        console.log(`[DataMigration] 执行: ${migrationMethod}`);
        await this[migrationMethod]();
        current = next;
      } else {
        console.warn(`[DataMigration] 未找到迁移方法: ${migrationMethod}`);
        // 如果没有特定迁移方法，直接复制数据
        this.copyData(current, next);
        current = next;
      }
    }
  },
  
  // 复制数据（无结构变更时）
  copyData(fromVersion, toVersion) {
    const dataKeys = ['data', 'user', 'config'];
    
    dataKeys.forEach(type => {
      const fromKey = `${this.STORAGE_PREFIX}${type}_v${fromVersion}`;
      const toKey = `${this.STORAGE_PREFIX}${type}_v${toVersion}`;
      const value = localStorage.getItem(fromKey);
      
      if (value) {
        localStorage.setItem(toKey, value);
      }
    });
  },
  
  // ========== 具体迁移方法 ==========
  
  // v1 -> v2 迁移（示例：添加新字段）
  async migrate_1_to_2() {
    console.log('[DataMigration] 执行 v1 -> v2 迁移');
    
    // 迁移业务数据
    const oldDataKey = `${this.STORAGE_PREFIX}data_v1`;
    const oldDataStr = localStorage.getItem(oldDataKey);
    
    if (oldDataStr) {
      const oldData = JSON.parse(oldDataStr);
      
      // 转换数据
      const newData = {
        ...oldData,
        
        // 商机数据：添加新的跟踪字段
        opportunities: (oldData.opportunities || []).map(opp => ({
          ...opp,
          // 新增字段：最后修改时间
          lastModifiedAt: opp.lastModifiedAt || opp.lastFollowAt || opp.createdAt,
          // 新增字段：创建人ID
          ownerId: opp.ownerId || null,
          // 新增字段：区域
          region: opp.region || null,
          // 确保 followUps 存在
          followUps: opp.followUps || []
        })),
        
        // 报备数据：添加区域字段
        registrations: (oldData.registrations || []).map(reg => ({
          ...reg,
          region: reg.region || null,
          owner: reg.owner || null,
          ownerId: reg.ownerId || null
        })),
        
        // 新增：系统配置表
        systemConfig: oldData.systemConfig || {
          theme: 'default',
          language: 'zh-CN',
          dateFormat: 'YYYY-MM-DD'
        }
      };
      
      localStorage.setItem(`${this.STORAGE_PREFIX}data_v2`, JSON.stringify(newData));
    }
    
    // 迁移用户数据
    const oldUserKey = `${this.STORAGE_PREFIX}user_v1`;
    const oldUserStr = localStorage.getItem(oldUserKey);
    
    if (oldUserStr) {
      const oldUser = JSON.parse(oldUserStr);
      
      const newUser = {
        ...oldUser,
        // 新增：登录历史
        loginHistory: oldUser.loginHistory || [],
        // 新增：偏好设置
        preferences: oldUser.preferences || {
          sidebarCollapsed: false,
          pageSize: 10
        }
      };
      
      localStorage.setItem(`${this.STORAGE_PREFIX}user_v2`, JSON.stringify(newUser));
    }
    
    console.log('[DataMigration] v1 -> v2 迁移完成');
  },
  
  // ========== 回滚功能 ==========
  
  // 回滚到指定版本
  rollback(targetVersion) {
    console.log(`[DataMigration] 开始回滚到 v${targetVersion}`);
    
    // 查找备份
    const prefix = `${this.STORAGE_PREFIX}backup_v${targetVersion}_`;
    const backups = Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .sort();
    
    if (backups.length === 0) {
      throw new Error(`未找到 v${targetVersion} 的备份`);
    }
    
    // 使用最新的备份
    const latestBackup = backups[backups.length - 1];
    const backupStr = localStorage.getItem(latestBackup);
    
    if (!backupStr) {
      throw new Error('备份数据为空');
    }
    
    const backup = JSON.parse(backupStr);
    
    // 恢复数据
    Object.entries(backup).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    
    // 更新版本标记
    this.setDataVersion(targetVersion);
    
    console.log(`[DataMigration] 已回滚到 v${targetVersion}`);
    
    if (typeof ElementPlus !== 'undefined') {
      ElementPlus.ElMessage.warning('数据已回滚到之前的版本');
    }
  },
  
  // ========== 数据导出/导入 ==========
  
  // 导出所有数据
  exportAll() {
    const data = {
      appVersion: this.APP_VERSION,
      dataVersion: this.DATA_VERSION,
      exportTime: new Date().toISOString(),
      exportBy: localStorage.getItem(`${this.STORAGE_PREFIX}user_v${this.DATA_VERSION}`),
      data: {}
    };
    
    // 收集所有相关数据
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.STORAGE_PREFIX)
    );
    
    keys.forEach(key => {
      try {
        data.data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data.data[key] = localStorage.getItem(key);
      }
    });
    
    return data;
  },
  
  // 导入数据
  async import(importData) {
    // 验证数据
    if (!importData || !importData.dataVersion) {
      throw new Error('无效的导入数据');
    }
    
    // 如果数据版本不同，需要先迁移
    if (importData.dataVersion !== this.DATA_VERSION) {
      console.log(`[DataMigration] 导入数据需要迁移: v${importData.dataVersion} -> v${this.DATA_VERSION}`);
      // 临时存储到旧版本，然后执行迁移
      Object.entries(importData.data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      await this.runMigrationChain(importData.dataVersion, this.DATA_VERSION);
    } else {
      // 直接导入
      Object.entries(importData.data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
    }
    
    this.setDataVersion(this.DATA_VERSION);
    console.log('[DataMigration] 数据导入完成');
  },
  
  // ========== 工具方法 ==========
  
  // 获取迁移状态
  getStatus() {
    return {
      appVersion: this.APP_VERSION,
      dataVersion: this.DATA_VERSION,
      currentVersion: this.getCurrentDataVersion(),
      needsMigration: this.getCurrentDataVersion() !== this.DATA_VERSION,
      lastUpdate: localStorage.getItem(`${this.STORAGE_PREFIX}last_update`),
      backups: this.getBackupList()
    };
  },
  
  // 获取备份列表
  getBackupList() {
    return Object.keys(localStorage)
      .filter(key => key.includes('backup_v'))
      .map(key => ({
        key,
        version: key.match(/backup_v(\d+)_/)?.[1],
        timestamp: parseInt(key.match(/_(\d+)$/)?.[1] || 0),
        date: new Date(parseInt(key.match(/_(\d+)$/)?.[1] || 0)).toLocaleString()
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  },
  
  // 清理所有数据（谨慎使用）
  clearAll() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.STORAGE_PREFIX)
    );
    keys.forEach(key => localStorage.removeItem(key));
    console.log('[DataMigration] 所有数据已清除');
  }
};

// 自动初始化（如果页面加载时调用）
if (typeof window !== 'undefined') {
  window.DataMigration = DataMigration;
}
