# 联软渠道管理平台 - 升级迭代方案

## 设计原则

1. **零数据丢失**：升级过程不影响现有业务数据
2. **向前兼容**：新版本兼容旧版本数据结构
3. **平滑过渡**：用户无感知升级，无需重新登录
4. **可回滚**：保留回退到旧版本的能力

---

## 版本管理规范

### 版本号格式
```
主版本.次版本.修订号
例如：2.1.3
```

- **主版本**：重大架构变更，可能破坏兼容性
- **次版本**：功能新增，保持向后兼容
- **修订号**：Bug 修复，完全兼容

### 版本标识
```javascript
// 在 app.js 顶部定义
const APP_VERSION = '2.1.0';
const APP_BUILD = '20260328';
const DATA_VERSION = '2';  // 数据结构版本
```

---

## 数据架构设计

### 1. 数据分层存储

```
localStorage 结构：
├── lianruan_user_v{version}      # 当前登录用户
├── lianruan_data_v{version}      # 业务数据（可导出）
├── lianruan_config_v{version}    # 用户配置
├── lianruan_cache_v{version}     # 临时缓存
└── lianruan_version              # 版本信息
```

### 2. 数据迁移机制

```javascript
// data-migration.js - 数据迁移模块
const DataMigration = {
  // 当前支持的数据版本
  SUPPORTED_VERSIONS: ['1', '2'],
  
  // 检查并执行迁移
  async migrate() {
    const currentVersion = localStorage.getItem('lianruan_data_version') || '1';
    const targetVersion = DATA_VERSION;
    
    if (currentVersion === targetVersion) return;
    
    console.log(`[Migration] ${currentVersion} -> ${targetVersion}`);
    
    // 备份旧数据
    this.backupData(currentVersion);
    
    // 执行迁移链
    let version = currentVersion;
    while (version < targetVersion) {
      const nextVersion = String(Number(version) + 1);
      await this[`migrate_${version}_to_${nextVersion}`]();
      version = nextVersion;
    }
    
    // 更新版本标记
    localStorage.setItem('lianruan_data_version', targetVersion);
    console.log('[Migration] 完成');
  },
  
  // 备份数据
  backupData(version) {
    const backupKey = `lianruan_backup_v${version}_${Date.now()}`;
    const data = localStorage.getItem(`lianruan_data_v${version}`);
    if (data) {
      localStorage.setItem(backupKey, data);
      console.log(`[Migration] 备份创建: ${backupKey}`);
    }
  },
  
  // v1 -> v2 迁移示例
  async migrate_1_to_2() {
    const oldData = JSON.parse(localStorage.getItem('lianruan_data_v1') || '{}');
    
    // 数据转换逻辑
    const newData = {
      ...oldData,
      // 新增字段赋予默认值
      opportunities: oldData.opportunities?.map(opp => ({
        ...opp,
        newField: opp.newField || 'default_value',
        // 其他字段转换...
      })) || [],
      // 新增数据表
      newTable: [],
    };
    
    localStorage.setItem('lianruan_data_v2', JSON.stringify(newData));
  },
  
  // 回滚到指定版本
  rollback(targetVersion) {
    // 查找备份
    const backups = Object.keys(localStorage).filter(k => 
      k.startsWith(`lianruan_backup_v${targetVersion}_`)
    );
    
    if (backups.length === 0) {
      throw new Error(`未找到 v${targetVersion} 的备份`);
    }
    
    // 使用最新的备份
    const latestBackup = backups.sort().pop();
    const data = localStorage.getItem(latestBackup);
    
    localStorage.setItem(`lianruan_data_v${targetVersion}`, data);
    localStorage.setItem('lianruan_data_version', targetVersion);
    
    console.log(`[Rollback] 已回滚到 ${targetVersion}`);
  }
};
```

---

## 升级包结构

### 升级包命名
```
lianruan-crm-upgrade-v{from}-to-v{to}-{date}.zip

示例：
lianruan-crm-upgrade-v2.0-to-v2.1-20260328.zip
```

### 升级包内容
```
lianruan-crm-upgrade-v2.0-to-v2.1-20260328/
├── upgrade.json          # 升级配置
├── frontend/             # 前端文件
│   ├── app.js
│   ├── data.js
│   ├── style.css
│   └── index.html
├── migrations/           # 数据迁移脚本
│   └── migrate-1-to-2.js
├── rollback/             # 回滚脚本
│   └── rollback-2-to-1.js
└── README.md             # 升级说明
```

### upgrade.json 配置
```json
{
  "version": {
    "from": "2.0.0",
    "to": "2.1.0",
    "dataVersion": "2"
  },
  "description": "新增报表中心和数据导出功能",
  "changes": [
    "新增：经营报表模块",
    "新增：数据导出功能",
    "优化：报价单界面",
    "修复：已知问题"
  ],
  "compatibility": {
    "minDataVersion": "1",
    "maxDataVersion": "2"
  },
  "requirements": {
    "minStorageMB": 50,
    "migrationRequired": true
  },
  "files": [
    {"path": "frontend/app.js", "action": "replace"},
    {"path": "frontend/data.js", "action": "replace"},
    {"path": "frontend/style.css", "action": "merge"}
  ],
  "scripts": {
    "preUpgrade": "pre-upgrade.sh",
    "postUpgrade": "post-upgrade.sh"
  }
}
```

---

## 升级脚本

### 一键升级脚本（upgrade.sh）

```bash
#!/bin/bash
# 联软渠道管理平台 - 升级脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
INSTALL_DIR="/opt/lianruan-crm"
UPGRADE_DIR="$1"
BACKUP_DIR="/opt/lianruan-crm-backups"

if [ -z "$UPGRADE_DIR" ]; then
    echo -e "${RED}用法: $0 <升级包目录>${NC}"
    exit 1
fi

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  联软渠道管理平台 - 升级程序${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""

# 1. 检查升级包
if [ ! -f "$UPGRADE_DIR/upgrade.json" ]; then
    echo -e "${RED}错误: 无效的升级包，缺少 upgrade.json${NC}"
    exit 1
fi

# 2. 解析升级信息
FROM_VERSION=$(jq -r '.version.from' "$UPGRADE_DIR/upgrade.json")
TO_VERSION=$(jq -r '.version.to' "$UPGRADE_DIR/upgrade.json")
DATA_VERSION=$(jq -r '.version.dataVersion' "$UPGRADE_DIR/upgrade.json")

echo -e "升级版本: ${YELLOW}$FROM_VERSION → $TO_VERSION${NC}"
echo -e "数据版本: ${YELLOW}$DATA_VERSION${NC}"
echo ""

# 3. 停止服务
echo -e "${YELLOW}[1/5] 停止服务...${NC}"
systemctl stop lianruan-crm || true
echo -e "${GREEN}✓ 服务已停止${NC}"

# 4. 创建备份
echo ""
echo -e "${YELLOW}[2/5] 创建完整备份...${NC}"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)-v${FROM_VERSION}"
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
cp -r "$INSTALL_DIR" "$BACKUP_DIR/$BACKUP_NAME/"
echo -e "${GREEN}✓ 备份创建: $BACKUP_DIR/$BACKUP_NAME${NC}"

# 5. 执行升级
echo ""
echo -e "${YELLOW}[3/5] 执行文件升级...${NC}"

# 执行前置脚本
if [ -f "$UPGRADE_DIR/scripts/pre-upgrade.sh" ]; then
    bash "$UPGRADE_DIR/scripts/pre-upgrade.sh" "$INSTALL_DIR"
fi

# 复制文件
while IFS= read -r file; do
    path=$(echo "$file" | jq -r '.path')
    action=$(echo "$file" | jq -r '.action')
    
    src="$UPGRADE_DIR/$path"
    dest="$INSTALL_DIR/$(dirname "$path")"
    
    if [ "$action" == "replace" ]; then
        cp "$src" "$dest/"
        echo "  替换: $path"
    elif [ "$action" == "merge" ]; then
        # CSS 合并逻辑
        cat "$src" >> "$dest/$(basename "$path")"
        echo "  合并: $path"
    fi
done < <(jq -c '.files[]' "$UPGRADE_DIR/upgrade.json")

echo -e "${GREEN}✓ 文件升级完成${NC}"

# 6. 数据迁移
echo ""
echo -e "${YELLOW}[4/5] 数据迁移...${NC}"
# 数据迁移在客户端自动执行
echo -e "${GREEN}✓ 数据迁移将在首次访问时自动执行${NC}"

# 7. 启动服务
echo ""
echo -e "${YELLOW}[5/5] 启动服务...${NC}"
systemctl start lianruan-crm

# 执行后置脚本
if [ -f "$UPGRADE_DIR/scripts/post-upgrade.sh" ]; then
    bash "$UPGRADE_DIR/scripts/post-upgrade.sh" "$INSTALL_DIR"
fi

echo -e "${GREEN}✓ 服务已启动${NC}"

# 8. 完成
echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  升级成功！${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo -e "当前版本: ${YELLOW}$TO_VERSION${NC}"
echo -e "访问地址: ${YELLOW}http://$(hostname -I | awk '{print $1}'):8080${NC}"
echo ""
echo -e "如需回滚，执行: ${YELLOW}$0 rollback $BACKUP_NAME${NC}"
```

---

## 客户端自动升级检测

```javascript
// 在 app.js 中添加升级检测
const UpgradeManager = {
  CHECK_INTERVAL: 3600000, // 1小时检查一次
  
  async init() {
    // 启动时检查数据迁移
    await DataMigration.migrate();
    
    // 检查版本更新
    this.checkForUpdates();
    
    // 定时检查
    setInterval(() => this.checkForUpdates(), this.CHECK_INTERVAL);
  },
  
  async checkForUpdates() {
    try {
      // 从服务器获取最新版本信息
      const response = await fetch('/version.json?t=' + Date.now());
      const serverVersion = await response.json();
      
      if (this.compareVersion(serverVersion.version, APP_VERSION) > 0) {
        this.notifyUpdate(serverVersion);
      }
    } catch (e) {
      // 静默失败，不影响用户使用
      console.log('[Upgrade] 检查更新失败', e);
    }
  },
  
  compareVersion(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  },
  
  notifyUpdate(info) {
    // 显示更新提示
    ElementPlus.ElNotification({
      title: '发现新版本',
      message: `v${info.version} 可用：${info.description}\n刷新页面即可更新`,
      type: 'info',
      duration: 0,
      showClose: true,
      onClick: () => {
        location.reload();
      }
    });
  }
};

// 在应用启动时初始化
onMounted(() => {
  UpgradeManager.init();
});
```

---

## 数据导出/导入功能

```javascript
// 数据管理组件
const DataManager = {
  // 导出所有数据
  exportAll() {
    const exportData = {
      version: APP_VERSION,
      dataVersion: DATA_VERSION,
      exportTime: new Date().toISOString(),
      data: {
        opportunities: store.opportunities,
        registrations: store.registrations,
        quotes: store.quotes,
        orders: store.orders,
        partners: store.partners,
        adminAccounts: store.adminAccounts,
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lianruan-crm-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  // 导入数据
  async import(file) {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // 验证数据版本
    if (!this.validateData(importData)) {
      throw new Error('数据文件格式无效或版本不兼容');
    }
    
    // 数据迁移（如果需要）
    if (importData.dataVersion !== DATA_VERSION) {
      importData.data = await this.migrateImportedData(
        importData.data, 
        importData.dataVersion, 
        DATA_VERSION
      );
    }
    
    // 合并或替换数据
    return importData.data;
  },
  
  validateData(data) {
    return data && 
           data.version && 
           data.dataVersion && 
           data.data &&
           typeof data.data === 'object';
  }
};
```

---

## 升级流程图

```
┌─────────────────┐
│   发布升级包     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 上传到服务器     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     否     ┌─────────────────┐
│ 执行 upgrade.sh │───────────▶│ 回滚到备份      │
└────────┬────────┘            └─────────────────┘
         │
         ▼
┌─────────────────┐
│ 停止服务        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 创建完整备份    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 替换前端文件    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 启动服务        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     是     ┌─────────────────┐
│ 用户刷新页面    │───────────▶│ 自动数据迁移    │
└─────────────────┘            └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │ 升级完成        │
                               └─────────────────┘
```

---

## 最佳实践

### 1. 开发阶段
- 每次修改数据结构时，同步更新 `DATA_VERSION`
- 编写对应的迁移脚本 `migrate_{old}_to_{new}`
- 测试数据迁移的向前/向后兼容性

### 2. 发布阶段
- 使用版本号标记 Git 提交
- 生成升级包并测试升级流程
- 编写升级说明文档

### 3. 部署阶段
- 在低峰期执行升级
- 先备份再升级
- 保留至少 3 个历史备份

### 4. 回滚策略
- 文件回滚：直接恢复备份目录
- 数据回滚：使用 `DataMigration.rollback()`
- 紧急回滚：停止服务 → 恢复备份 → 启动服务
