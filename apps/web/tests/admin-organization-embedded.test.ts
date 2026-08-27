import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 正式管理员脚本地址 = resolve(process.cwd(), "public/admin-app.js");
const 正式管理员页面地址 = resolve(process.cwd(), "public/admin.html");
const 正式管理员样式地址 = resolve(process.cwd(), "public/style.css");

describe("正式管理员页组织架构内嵌路由", () => {
  it("注册组织架构内嵌子路由并保留独立工作区过渡通道", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("{ path: 'organization', redirect: '/organization/units' }");
    expect(脚本文本).toContain("{ path: 'organization/units', component: OrganizationWorkspace }");
    expect(脚本文本).toContain("{ path: 'organization/staff', component: OrganizationWorkspace }");
    expect(脚本文本).toContain(
      "{ path: 'organization/business-roles', component: OrganizationWorkspace }",
    );
    expect(脚本文本).toContain(
      "{ path: 'organization/certifications', component: OrganizationWorkspace }",
    );
    expect(脚本文本).toContain(
      "{ path: 'organization/data-scopes', component: OrganizationWorkspace }",
    );
    expect(脚本文本).toContain(
      "{ path: 'organization/offboarding', component: OrganizationWorkspace }",
    );
    expect(脚本文本).toContain(
      "{ path: 'organization/directory-sync', component: OrganizationWorkspace }",
    );
  });

  it("侧边栏入口使用内部路由并带激活态", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("router.push('/organization/units')");
    expect(脚本文本).toContain("$route.path.startsWith('/organization')");
    expect(脚本文本).not.toContain(
      "window.location.assign('/workspace/admin/platform-admin/organization/units')",
    );
  });

  it("组织架构路由仅超级管理员可访问", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain(
      "if (to.path.startsWith('/organization') && store.user?.role !== 'superadmin') return '/dashboard';",
    );
  });

  it("内嵌组件仅使用签名 Cookie 会话的组织接口，不经过 /api/v2", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("credentials: 'include'");
    expect(脚本文本).toContain("'/api/org/status'");
    expect(脚本文本).toContain("'/api/org/units/tree'");
    expect(脚本文本).toContain("'/api/integrations/directory-sync/status'");
    expect(脚本文本).not.toContain("/api/v2/org");
  });

  it("正式页面引用内嵌版本资源", async () => {
    const 页面文本 = await readFile(正式管理员页面地址, "utf8");

    expect(页面文本).toContain('<script src="admin-app.js?v=158"></script>');
    expect(页面文本).toContain('<link rel="stylesheet" href="style.css?v=16" />');
    expect(页面文本).toContain('<script src="libs/xlsx.full.min.js"></script>');
  });

  it("组织架构采用左树右表：左侧部门树，右侧成员概要信息与证书", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("左侧选择部门，右侧查看该部门成员；历史账号须人工核对后再建立任职");
    expect(脚本文本).toContain("<el-tree");
    expect(脚本文本).toContain("组织成员卡片");
    expect(脚本文本).toContain("组织成员概要");
    expect(脚本文本).toContain("组织成员证书");
    expect(脚本文本).toContain("证书状态类型");
    expect(脚本文本).toContain("证书详情");
    expect(脚本文本).toContain("当前部门成员");
    expect(脚本文本).toContain("节点成员数");
    expect(脚本文本).toContain("直属负责人");
  });

  it("组织架构同时提供渠道组织树只读卡片，且采用左树右表", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");
    const 组织组件文本 = 脚本文本.slice(
      脚本文本.indexOf("const OrganizationWorkspace ="),
      脚本文本.indexOf("const router = createRouter"),
    );
    const 模板返回块 = 组织组件文本.slice(组织组件文本.lastIndexOf("    return {"));

    expect(脚本文本).toContain(
      "组织读取渠道组织树() { return 组织读取('/api/org/channel-tree'); }",
    );
    expect(脚本文本).toContain("渠道组织树");
    expect(脚本文本).toContain("左侧按大区、区域、渠道商层级查看");
    expect(脚本文本).toContain("渠道树数据");
    expect(脚本文本).toContain("当前渠道成员");
    expect(脚本文本).toContain("当前渠道类型");
    expect(脚本文本).toContain("过滤后渠道成员");
    expect(脚本文本).toContain("企业管理员");
    expect(脚本文本).toContain("memberRoleCode");
    expect(脚本文本).toContain("partner_admin");
    expect(脚本文本).toContain("平铺渠道组织列表");
    expect(脚本文本).toContain("展开渠道树");
    expect(脚本文本).toContain(
      "function 聚合渠道成员(单元, 所属渠道商Id = '', 所属渠道商名称 = '')",
    );
    expect(脚本文本).toContain("const 是渠道商 = Boolean(单元.partnerName || 单元.partnerCode)");
    expect(脚本文本).toContain("partnerId: 成员.partnerId || 渠道商Id");
    expect(脚本文本).toContain("partnerName: 成员.partnerName || 渠道商名称");
    expect(脚本文本).toContain("大区、区域、渠道商");
    expect(脚本文本).toContain("搜索大区/区域/渠道商");
    expect(模板返回块).toContain("渠道同步预览摘要");
    expect(模板返回块).toContain("渠道同步中");
    expect(模板返回块).toContain("渠道同步弹窗打开");
    expect(模板返回块).toContain("打开渠道同步预览");
    expect(模板返回块).toContain("执行渠道商同步");
  });

  it("组织架构提供部门快捷下拉与搜索，数量多时便于定位", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("快捷选择部门（含全部层级）");
    expect(脚本文本).toContain("平铺树数据");
    expect(脚本文本).toContain("定位部门");
    expect(脚本文本).toContain("部门搜索词");
    expect(脚本文本).toContain("过滤部门节点");
  });

  it("部门与成员支持 Excel 全量覆盖导入导出", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("组织导出部门() { return 组织读取('/api/org/units/export'); }");
    expect(脚本文本).toContain("组织导出成员() { return 组织读取('/api/org/staff/export'); }");
    expect(脚本文本).toContain("组织导入部门(rows");
    expect(脚本文本).toContain("组织导入成员(rows");
    expect(脚本文本).toContain("导入部门");
    expect(脚本文本).toContain("导出部门");
    expect(脚本文本).toContain("导入成员");
    expect(脚本文本).toContain("导出成员");
    expect(脚本文本).toContain("XLSX.utils.sheet_to_json");
    expect(脚本文本).toContain("XLSX.writeFile");
    expect(脚本文本).toContain("部门名称");
    expect(脚本文本).toContain("上级部门");
    expect(脚本文本).toContain("用户名");
  });

  it("新建组织不再要求录入组织编码与组织类型，由服务端自动生成", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).not.toContain('label="组织编码"');
    expect(脚本文本).not.toContain('label="组织类型"');
    expect(脚本文本).toContain("组织创建组织({");
    expect(脚本文本).toContain("unitName: 新建表单.unitName");
    expect(脚本文本).not.toContain("unitCode: 新建表单.unitCode");
    expect(脚本文本).not.toContain("unitType: 新建表单.unitType");
  });

  it("渠道组织树为只读来源，不与内部组织树混写", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain(
      "组织读取渠道组织树() { return 组织读取('/api/org/channel-tree'); }",
    );
    expect(脚本文本).not.toContain("只读数据，来源于渠道商管理");
    expect(脚本文本).toContain("组织树.value = 组织.items;");
    expect(脚本文本).toContain("渠道组织树.value = 渠道.items;");
    expect(脚本文本).not.toContain("组织写入('/api/org/channel-tree'");
  });

  it("导入导出门禁与读写开关保持一致", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain('v-if="可写" @click="触发文件选择(\'部门\')"');
    expect(脚本文本).toContain('v-if="可写" @click="触发文件选择(\'成员\')"');
    expect(脚本文本).toContain("if (!file || !可写.value) return;");
  });
});

it("组织架构统一维护账号：成员可编辑、可按组织新建用户、账号检索", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("打开成员编辑");
  expect(脚本文本).toContain("打开账号编辑");
  expect(脚本文本).toContain("打开任职编辑");
  expect(脚本文本).toContain("打开新建用户弹窗");
  expect(脚本文本).toContain("提交新建用户");
  expect(脚本文本).toContain("检索账号（用户名/姓名）");
  expect(脚本文本).toContain("'/api/rbac/accounts'");
  expect(脚本文本).toContain("未找到匹配账号。");
  expect(脚本文本).toContain("组织账号检索结果");
  expect(脚本文本).toContain("组织抽屉遮罩");
  expect(脚本文本).toContain("组织抽屉区块");
  expect(脚本文本).toContain("保存基本信息");
  expect(脚本文本).toContain("重置密码");
  expect(脚本文本).not.toContain("切换账号状态");
  expect(脚本文本).toContain("打开停用归档");
  expect(脚本文本).toContain("保存任职");
  expect(脚本文本).toContain("开始调整任职");
  expect(脚本文本).toContain("结束任职");
  expect(脚本文本).toContain("指派业务角色");
  expect(脚本文本).toContain("颁发证书");
  expect(脚本文本).toContain("撤销证书");
  expect(脚本文本).toContain("apiRequest('POST', '/users', 账号载荷)");
  expect(脚本文本).toContain("组织创建任职(用户Id");
});

it("编辑内部成员时部门下拉绑定完整组织树，并以部门标识提交任职", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("const 平铺组织列表 = computed(() => 展开组织树(组织树.value));");
  expect(脚本文本).toContain(
    '<el-select v-model="新任职表单.orgUnitId" size="small" placeholder="选择部门" filterable :teleported="true" popper-class="组织账号顶层下拉"',
  );
  expect(脚本文本).toContain('placeholder="选择部门"');
  expect(脚本文本).toContain('v-for="组织 in 平铺组织列表"');
  expect(脚本文本).toContain(":label=\"'　'.repeat(组织.层级 || 0) + 组织.unitName\"");
  expect(脚本文本).toContain(':value="组织.id"');
  expect(脚本文本).toContain("@change=\"新任职表单.positionId = ''\"");
  expect(脚本文本).toContain("const 当前部门岗位列表 = computed(() =>");
  expect(脚本文本).toContain(
    "岗位列表.value.filter((p) => p.orgUnitId === 新任职表单.orgUnitId && p.statusCode === 'active')",
  );
  expect(脚本文本).toContain('v-for="岗位 in 当前部门岗位列表"');
  expect(脚本文本).toContain("orgUnitId: 新任职表单.orgUnitId");
});

it("内部成员可编辑，渠道成员通过统一资料维护基本信息、单一业务角色和多证书", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  // 内部成员卡片整卡可点击进入编辑
  expect(脚本文本).toContain(":class=\"{ '组织成员卡片-可点击': 可写 }\"");
  expect(脚本文本).toContain('@click="可写 && 打开成员编辑(成员)"');
  expect(脚本文本).toContain("打开统一渠道成员资料");
  expect(脚本文本).toContain("编辑资料、角色与证书");
  expect(脚本文本).toContain("const 证书结果 = await 组织查询成员证书({ userId });");
  // 渠道成员仍展示其成员关系，便于核对。
  expect(脚本文本).toContain("成员.isAdmin ? '企业管理员' : '普通成员'");
  // 渠道成员概要携带 userId/partnerId/状态
  expect(脚本文本).toContain("userId: 成员.userId || ''");
  expect(脚本文本).toContain("partnerId: 成员.partnerId || partnerId");
  expect(脚本文本).toContain("statusCode: 成员.statusCode || 'active'");
  expect(脚本文本).toContain("组织架构、渠道商员工、企业管理员、经营报表四处实时共用");
  expect(脚本文本).toContain("业务角色二选一，只表示人员职责，不自动授予系统权限。");
  expect(脚本文本).toContain("证书变化不会自动改变业务角色或系统权限。");
});

it("岗位字典管理卡片已下线，岗位数据保留", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).not.toContain("新建岗位");
  expect(脚本文本).not.toContain("打开新建弹窗('position')");
  expect(脚本文本).toContain("function 组织创建岗位"); // 接口保留，仅下线管理卡片
  expect(脚本文本).toContain("查询岗位");
});

it("UI 展示全中文：编码值映射为中文标签，时间统一格式", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("function 状态中文");
  expect(脚本文本).toContain("function 角色中文");
  expect(脚本文本).toContain("function 领域中文");
  expect(脚本文本).toContain("function 业务角色类别中文");
  expect(脚本文本).toContain("function 证书类别中文");
  expect(脚本文本).toContain("function 格式化时间");
  expect(脚本文本).toContain("active: '启用'");
  expect(脚本文本).toContain("internal: '内部'");
  expect(脚本文本).toContain("{{ 格式化时间(成员.effectiveAt) }}");
  expect(脚本文本).toContain("{{ 格式化时间(row.issuedOn) }}");
  expect(脚本文本).toContain("{{ 格式化时间(row.expiresOn, '长期有效') }}");
  expect(脚本文本).toContain("{{ 状态中文(row.statusCode) }}");
  // 业务角色栏目整体隐藏后，"领域中文(row.domainCode)" 这条模板已从页面移除；
  // 函数本身仍保留（断言上一行已覆盖），此处仅保留对未移除模板的检查。
});

it("人员与任职入口下线，导入导出成员迁移到组织与岗位", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).not.toContain("人员与任职");
  expect(脚本文本).not.toContain("当前栏目 === 'staff'");
  expect(脚本文本).toContain("触发文件选择('成员')");
  expect(脚本文本).toContain("导出成员Excel");
});

it("证书管理支持按部门/渠道商/类别筛选，文案统一为证书名称", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("证书筛选树数据");
  expect(脚本文本).toContain("选择证书筛选节点");
  expect(脚本文本).toContain("证书筛选类别");
  expect(脚本文本).toContain("加载证书筛选结果");
  expect(脚本文本).toContain("按证书名称检索");
  expect(脚本文本).toContain("证书名称检索词");
  expect(脚本文本).toContain("按证书类别筛选");
  expect(脚本文本).toContain('label="证书名称"');
  expect(脚本文本).toContain("选择证书名称");
  expect(脚本文本).toContain("新建证书");
  expect(脚本文本).not.toContain("新建证书模板");
  expect(脚本文本).not.toContain('label="模板名称"');
  expect(脚本文本).not.toContain('label="模板编码"');
  expect(脚本文本).not.toContain("<h2>证书模板</h2>");
});

it("正式页明确证书与业务角色不自动联动", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("证书到期仅告警，不自动撤销业务角色");
  expect(脚本文本).toContain("不会自动授予或撤销业务角色");
  expect(脚本文本).not.toContain("颁发证书后自动授予业务角色");
  expect(脚本文本).not.toContain("证书颁发后自动授予角色");
  expect(脚本文本).not.toContain("撤销证书后自动回收业务角色");
  expect(脚本文本).not.toContain("证书撤销后自动回收角色");
});

it("角色管理页支持管理员角色配置与用户角色分配", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("{ 栏目: 'rbac', 名称: '角色管理', 路径: '/organization/rbac' }");
  expect(脚本文本).toContain("{ path: 'organization/rbac', component: OrganizationWorkspace }");
  expect(脚本文本).toContain("组织读取角色列表");
  expect(脚本文本).toContain("'/api/rbac/roles'");
  expect(脚本文本).toContain("组织读取权限字典");
  expect(脚本文本).toContain("'/api/rbac/permissions'");
  expect(脚本文本).toContain("组织覆盖用户角色");
  expect(脚本文本).toContain("'/api/rbac/users/' + 组织编码路径参数(userId) + '/roles'");
  expect(脚本文本).toContain("管理员角色（可选，多选）");
  expect(脚本文本).toContain("保存用户管理员角色");
  expect(脚本文本).toContain("系统角色与有效权限");
  expect(脚本文本).toContain("角色调整不修改 IAM、UniSDP");
  expect(脚本文本).toContain("组织查询角色用户");
  expect(脚本文本).toContain("'/api/rbac/roles/' + 组织编码路径参数(roleId) + '/users'");
  expect(脚本文本).toContain("打开角色用户");
  expect(脚本文本).toContain("业务权限分组");
  expect(脚本文本).toContain("用户权限分组");
  expect(脚本文本).toContain("组织范围");
  expect(脚本文本).toContain("if (角色.isSystem) return '全局';");
});

it("账号编辑抽屉低于 Element Plus 弹层，部门、角色和证书下拉不会被遮挡", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");
  const 样式文本 = await readFile(正式管理员样式地址, "utf8");

  expect(脚本文本).toContain('v-model="角色编辑弹窗打开"');
  expect(脚本文本).toContain(":title=\"角色表单.id ? '编辑角色' : '新建角色'\"");
  expect(脚本文本).toMatch(/v-model="角色编辑弹窗打开"[\s\S]{0,180}append-to-body/);
  expect(脚本文本).toMatch(/v-model="角色用户弹窗打开"[^>]*append-to-body/);
  expect(样式文本).toMatch(/\.组织抽屉遮罩\s*\{[\s\S]*?z-index:\s*1900;/);
  expect(样式文本).not.toMatch(/\.组织抽屉遮罩\s*\{[\s\S]*?z-index:\s*3000;/);
});

it("账号抽屉将泛微 OA 候选与正式映射隔离，候选不可用于发起流程", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("组织读取泛微OA身份(userId)");
  expect(脚本文本).toContain("组织创建泛微OA身份候选(userId");
  expect(脚本文本).toContain("组织确认泛微OA身份候选(userId");
  expect(脚本文本).toContain("泛微 OA 身份");
  expect(脚本文本).toContain("候选身份不会自动绑定，也不能用于流程发起。");
  expect(脚本文本).toContain("泛微 OA 身份候选已保存，尚不能用于发起流程。");
  expect(脚本文本).toContain("确认后该身份将可用于 OA 发起");
  expect(脚本文本).toContain("确认正式映射");
  expect(脚本文本).toContain("rowVersion: 待核验泛微候选.value.rowVersion");
  expect(脚本文本).toContain("rowVersion: 泛微OA身份.value.formalIdentity.rowVersion");
  expect(脚本文本).toContain("幂等键: 生成组织幂等键()");
});

it("从角色用户弹窗进入账号授权时先关闭原弹窗，避免账号抽屉被遮挡", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toMatch(
    /async function 打开角色用户账号\(账号\)\s*\{\s*角色用户弹窗打开\.value = false;\s*await nextTick\(\);\s*await 打开账号编辑\(/,
  );
});

it("账号抽屉内部门、系统角色、证书和交接接收人下拉统一传送到顶层浮层", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  const 顶层下拉类出现次数 = 脚本文本.match(/popper-class="组织账号顶层下拉"/g)?.length || 0;
  const 顶层下拉标签 =
    脚本文本.match(/<el-(?:select|tree-select)\b[^>]*popper-class="组织账号顶层下拉"[^>]*>/g) || [];
  expect(顶层下拉类出现次数).toBeGreaterThanOrEqual(4);
  expect(顶层下拉标签).toHaveLength(顶层下拉类出现次数);
  expect(顶层下拉标签.every((标签) => 标签.includes(':teleported="true"'))).toBe(true);
  expect(脚本文本).toContain('v-model="新任职表单.orgUnitId"');
  expect(脚本文本).toContain('v-model="编辑用户管理员角色Ids"');
  expect(脚本文本).toContain('v-model="新证书表单.certificationTemplateId"');
  expect(脚本文本).toContain('v-model="离职确认表单.replacementUserId"');
});

it("旧账号管理不再直接停用超管或区管，统一进入影响预览和交接确认", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).not.toContain("async function toggleStatus(a)");
  expect(脚本文本).not.toContain('@click="toggleStatus(a)"');
  expect(脚本文本).toContain("function openOffboarding(a)");
  expect(脚本文本).toContain("query: { account: a.username || a.id, action: 'offboarding' }");
  expect(脚本文本).toContain("async function 处理账号深链()");
  expect(脚本文本).toContain("if (路由.query.action === 'offboarding') await 打开停用归档();");
  const 新建状态字段出现次数 =
    脚本文本.match(/status: form\.role === 'superadmin' \? 'active' : form\.status,/g)?.length || 0;
  expect(新建状态字段出现次数).toBe(1);
});

it("账号入口合并后旧账号管理直达路径重定向到正式组织页面", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toMatch(
    /账号入口已合并\.value\s*&&\s*route\.path\s*===\s*['"]\/account-manage['"][\s\S]{0,160}router\.(?:replace|push)\(['"]\/organization\/units['"]\)/,
  );
  expect(脚本文本).toMatch(
    /账号入口已合并\.value\s*&&\s*route\.path\s*===\s*['"]\/account-manage\/staff-import['"][\s\S]{0,160}router\.(?:replace|push)\(['"]\/organization\/units['"]\)/,
  );
});

it("渠道成员四处入口共用统一资料，业务角色严格单选且证书支持多选", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  const 统一资料挂载次数 = 脚本文本.match(/<ChannelMemberProfileDialog/g)?.length || 0;
  expect(统一资料挂载次数).toBe(4);
  expect(脚本文本).toContain("组织架构、渠道商员工、企业管理员、经营报表四处实时共用");
  expect(脚本文本).toContain('const PartnerReport = {\n  components: { ChannelMemberProfileDialog },');
  expect(脚本文本).toContain("console.warn('经营报表渠道商数据加载失败：', error);");
  expect(脚本文本).toMatch(/const PartnerReport = \{[\s\S]*?onMounted\(loadPartners\);/);
  expect(脚本文本).toContain('function normalizedMetric(value)');
  expect(脚本文本).toContain('quoteCount: normalizedMetric(partner.quoteCount)');
  expect(脚本文本).toContain('orderCount: normalizedMetric(partner.orderCount)');
  expect(脚本文本).toContain('totalAmt: normalizedMetric(partner.totalAmt)');
  expect(脚本文本).toContain('@click="editStaff(s)"');
  expect(脚本文本).toContain("if (store.user?.role === 'superadmin')");
  expect(脚本文本).toContain("经营报表渠道商详情刷新失败");
  expect(脚本文本).toContain(
    "const form = reactive({ name: '', phone: '', email: '', businessRoleCode: 'channel_sales', certificationTemplateIds: [] });",
  );
  expect(脚本文本).toContain('<select class="form-control" v-model="form.businessRoleCode">');
  expect(脚本文本).toContain('<option value="channel_sales">销售</option>');
  expect(脚本文本).toContain('<option value="channel_technical">技术</option>');
  expect(脚本文本).toContain(
    'type="checkbox" :value="template.id" v-model="form.certificationTemplateIds"',
  );
  expect(脚本文本).toContain("grantCertificationTemplateIds: form.certificationTemplateIds.filter");
  expect(脚本文本).toContain("revokeCertificationIds: active.filter");
  expect(脚本文本).toContain(
    "const memberId = props.member.partnerMemberId || props.member.memberId || '';",
  );
  expect(脚本文本).toContain("partnerMemberId: admin.partnerMemberId || admin.memberId || ''");
  expect(脚本文本).toContain("partnerMemberId: 成员.id");
});

it("企业管理员身份与销售技术职责独立保存，统一资料不得改写成员身份", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain(
    "profile.memberRoleCode === 'partner_admin' ? '企业管理员' : '普通员工'",
  );
  expect(脚本文本).toContain("企业管理员身份和审批状态独立保存，不会被“销售/技术”业务角色覆盖。");
  expect(脚本文本).not.toContain('v-model="form.memberRoleCode"');
  expect(脚本文本).not.toContain('v-model="form.accountRole"');
  expect(脚本文本).not.toMatch(/组织保存渠道成员档案\([\s\S]{0,600}memberRoleCode\s*:/);
});

it("正式页布局具备 1366×768 与常用缩放下的收缩和滚动边界", async () => {
  const 样式文本 = await readFile(正式管理员样式地址, "utf8");

  expect(样式文本).toMatch(/\.组织成员面板\s*\{[\s\S]*?min-width:\s*0;/);
  expect(样式文本).toMatch(/\.组织成员网格\s*\{[\s\S]*?overflow:\s*auto;/);
  expect(样式文本).toMatch(
    /@media \(max-width:\s*960px\)\s*\{[\s\S]*?\.组织左右布局\s*\{[\s\S]*?flex-direction:\s*column;/,
  );
  expect(样式文本).toMatch(/\.组织抽屉\s*\{[\s\S]*?width:\s*min\(880px,\s*94vw\);/);
  expect(样式文本).toMatch(/\.组织抽屉\s*\{[\s\S]*?height:\s*min\(86vh,\s*880px\);/);
  expect(样式文本).toMatch(/\.组织抽屉主体\s*\{[\s\S]*?overflow-y:\s*auto;/);
});

it("历史账号仅允许人工归集，组织模块提供停用交接且不编辑渠道成员职责", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain("请通过账号检索逐一核对后，为确认属于内部人员的账号添加任职");
  expect(脚本文本).toContain("姓名、电话、邮箱、销售/技术角色和证书四处共用；企业管理员身份、审批、账号状态与系统权限独立。");
  expect(脚本文本).toContain('<el-tag size="small" type="success">当前任职</el-tag>');
  expect(脚本文本).not.toContain("成员.isPrimary ? '主职' : '兼职'");
  expect(脚本文本).not.toContain("'/api/org/admin-accounts/sync'");
  expect(脚本文本).not.toContain("组织删除用户");
  expect(脚本文本).not.toContain("组织写入('/api/org/users/' + 组织编码路径参数(userId), 'DELETE'");
  expect(脚本文本).not.toContain("删除账号");
  expect(脚本文本).toContain("停用并交接");
  expect(脚本文本).toContain("confirmationUsername");
});

it("停用交接先展示影响与接收人，独立开关关闭时只能预览", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toMatch(
    /<el-button[^>]*@click="打开停用归档"[^>]*>删除（停用并交接）<\/el-button>/,
  );
  expect(脚本文本).toContain("const 预览 = await 组织预览离职影响(编辑用户.value.id);");
  expect(脚本文本).toContain('v-model="离职交接弹窗打开"');
  expect(脚本文本).toContain('v-if="!组织功能状态?.offboardingEnabled"');
  expect(脚本文本).toContain('v-if="!组织功能状态?.accountStatusCheckEnabled"');
  expect(脚本文本).toContain("账号停权防护已开启");
  expect(脚本文本).toContain("当前环境只允许预览，尚未开放执行");
  expect(脚本文本).toContain('v-model="离职确认表单.replacementUserId"');
  expect(脚本文本).toContain("请选择同区域有效区管或其他有效超级管理员");
  expect(脚本文本).toContain("confirmationUsername.trim().toLowerCase()");
  expect(脚本文本).toContain("!组织功能状态.value?.offboardingEnabled");
  expect(脚本文本).toContain(':disabled="!可提交离职交接"');
});

it("组织总开关关闭不读取数据，只读模式隐藏全部写入入口", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  expect(脚本文本).toContain('v-if="!加载中 && !已启用"');
  expect(脚本文本).toContain("当前环境保持默认关闭，不读取或修改组织数据");
  expect(脚本文本).toContain('v-else-if="!加载中 && !可写"');
  expect(脚本文本).toContain("所有写入按钮均保持关闭");
  expect(脚本文本).toContain(
    "const 可写 = computed(() => 已启用.value && 组织功能状态.value && 组织功能状态.value.writeEnabled === true);",
  );
  expect(脚本文本).toContain('v-if="可写" type="primary"');
  expect(脚本文本).toContain("if (!已启用.value) return;");
  expect(脚本文本).toContain("if (!状态.enabled) return;");
});

it("内部组织树节点计数与成员聚合结果一致，父级节点不重复累加子孙", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  // 构建树节点() 已把子孙成员聚合进 members，节点成员数() 必须直接取聚合长度，
  // 否则父级节点会按"直属 + 子孙递归"重复累加（面板显示 8 人、树上显示 12 人）。
  expect(脚本文本).toContain("const 聚合 = (单元.members || []).slice();");
  expect(脚本文本).toContain("for (const 子 of 子节点) 聚合.push(...(子.members || []));");
  expect(脚本文本).toContain("function 节点成员数(节点)");
  expect(脚本文本).toContain("return (节点.members || []).length;");
  expect(脚本文本).not.toContain(
    "const 子孙 = (节点.children || []).reduce((合计, 子节点) => 合计 + 节点成员数(子节点), 0);",
  );
});

it("RBAC 渠道范围按节点实际类型分别提交 region 与 partner", async () => {
  const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

  // 渠道组织树包含大区/区域（region）与渠道商（partner）两类节点，
  // 提交时须按节点实际类型判定，渠道商节点不得再被误标为 region。
  expect(脚本文本).toContain("const 目标 = 平铺渠道组织列表.value.find((项) => 项.id === id);");
  expect(脚本文本).toContain(
    "const 是渠道商 = Boolean(目标 && (目标.partnerName || 目标.partnerCode));",
  );
  expect(脚本文本).toContain("是渠道商 ? 'partner' : 'region'");
  expect(脚本文本).not.toContain(
    "for (const id of 角色表单.范围.渠道Ids) 范围.push({ scopeType: 'region', scopeRefId: id });",
  );
});
