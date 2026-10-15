# 参考架构与升级路径

## 1. 参考系统

参考系统用于借鉴架构和排版模式，不作为项目依赖。

| 系统                | 借鉴内容                                 | 不直接采用的内容           |
| ------------------- | ---------------------------------------- | -------------------------- |
| Vben Admin          | 路由、菜单、权限、组织化工作区           | 不引入其完整主题和业务模型 |
| Soybean Admin       | 设计令牌、主题、布局层次和页面骨架       | 不新增第二套 UI 组件库     |
| Arco Design Pro Vue | 高密度表格、查询表单、详情抽屉和管理配置 | 不替换现有 Element Plus    |
| Tabler              | 管理后台的信息密度、导航和表格组织       | 不照搬视觉风格             |
| Refine              | Repository、资源动作和 CRUD 分层思路     | 不迁移 React 技术栈        |

## 2. 推荐的模块边界

```text
features/<module>/
  pages/
  components/
  repositories/
  models/
  permissions/
  fixtures/
  tests/
```

页面只调用 feature 内 repository。后端未完成时使用同形状的 mock repository，后端完成后只替换数据源。

## 3. 共享层

```text
packages/shared/src/
  opportunity-stage.ts
  status-dictionary.ts
  permission-codes.ts
  error-codes.ts

apps/web/src/design-system/
  layout/
  data-table/
  filter-bar/
  status-tag/
  detail-drawer/
  action-modal/
  feedback/
```

阶段、状态和错误码只能定义一次。

## 4. 升级路径

1. 初始化设计系统和权限元数据。
2. 建立 Vue 工作区的外壳和路由。
3. 替换工作台和主业务链。
4. 新增线索管理前端 UI。
5. 替换渠道、产品和组织账号页面。
6. 下线未建设模块入口。
7. 清除旧静态页面的业务逻辑并保留兼容跳转。

## 5. 不推荐的做法

- 在 `admin-app.js` 和 `partner-app.js` 中继续新增大量页面。
- 复制多套阶段和状态定义。
- 前端自行计算正式金额、收益或审批状态。
- 通过 CSS 无限缩放适配小屏幕。
- 用占位页面冒充已建设功能。
