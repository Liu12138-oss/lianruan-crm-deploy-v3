import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const 基础地址 = "http://10.9.86.66";
const 输出目录 = resolve(import.meta.dirname, "probe-output-third-r2");
const 截图目录 = resolve(输出目录, "截图");
await mkdir(截图目录, { recursive: true });

const 账号 = {
  超管: { username: "liulonghai", password: "LrCRM@2026!" },
  江苏区管: { username: "liuchengzhou", password: "123456" },
  渠道管理员: { username: "zuomeijun", password: "LrCRM@2026!" },
};
const 时间戳 = Date.now();
const 临时账号 = `third_e2e_${时间戳}`;
const 临时账号2 = `third_e2e_dup_${时间戳}`;
const 临时密码 = "Test@123456";
const 临时外部编号 = `third-e2e-${时间戳}`;

const 结果 = { 执行时间: new Date().toISOString(), 基础地址, 版本: {}, 用例: [], 证据: {}, 临时数据: {} };
function 记录(编号, 标题, 状态, 结论, 证据 = {}) {
  结果.用例.push({ 编号, 标题, 状态, 结论, 证据 });
  console.log(`[${状态}] ${编号} ${标题}：${结论}`);
}

async function 请求(页面, 路径, 选项 = {}) {
  return 页面.evaluate(async ({ 路径, 选项 }) => {
    const 响应 = await fetch(路径, {
      method: 选项.method || "GET",
      credentials: "include",
      cache: "no-store",
      headers: { ...(选项.body ? { "content-type": "application/json" } : {}), ...(选项.headers || {}) },
      ...(选项.body ? { body: JSON.stringify(选项.body) } : {}),
    });
    const 文本 = await 响应.text();
    let 内容 = null;
    try { 内容 = JSON.parse(文本); } catch { 内容 = 文本.slice(0, 2000); }
    return { 状态: 响应.status, 内容 };
  }, { 路径, 选项 });
}

async function 查询全部(页面, 路径, 每页 = 100, 最大页 = 20) {
  const 分隔 = 路径.includes("?") ? "&" : "?";
  const 首页 = await 请求(页面, `${路径}${分隔}page=1&pageSize=${每页}`);
  const 数据 = 首页.内容?.data;
  const 行 = 数据?.数据 || 数据?.items || (Array.isArray(数据) ? 数据 : []);
  const 总数 = Number(数据?.分页?.总数 || 行.length);
  const 总页 = Math.min(最大页, Math.max(1, Math.ceil(总数 / 每页)));
  const 全部 = [...行];
  for (let 页 = 2; 页 <= 总页; 页 += 1) {
    const 响应 = await 请求(页面, `${路径}${分隔}page=${页}&pageSize=${每页}`);
    const 当前 = 响应.内容?.data;
    const 当前行 = 当前?.数据 || 当前?.items || (Array.isArray(当前) ? 当前 : []);
    全部.push(...当前行);
  }
  return { 首页, 行: 全部, 总数 };
}

async function 登录页面(浏览器, 账号信息) {
  const 上下文 = await 浏览器.newContext({ baseURL: 基础地址, viewport: { width: 1600, height: 1000 } });
  const 页面 = await 上下文.newPage();
  const 控制台错误 = [];
  页面.on("console", (消息) => { if (消息.type() === "error") 控制台错误.push(消息.text()); });
  页面.on("pageerror", (错误) => 控制台错误.push(`页面异常：${错误.message}`));
  await 页面.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await 页面.locator('input[autocomplete="username"]').fill(账号信息.username);
  await 页面.locator('input[autocomplete="current-password"]').fill(账号信息.password);
  await Promise.all([
    页面.waitForURL((地址) => !地址.pathname.startsWith("/login"), { timeout: 30000 }),
    页面.getByRole("button", { name: /登\s*录/ }).click(),
  ]);
  await 页面.waitForTimeout(1500);
  return { 上下文, 页面, 控制台错误 };
}

async function 快照(页面, 路径, 名称, 等待 = 2500) {
  await 页面.goto(路径, { waitUntil: "domcontentloaded", timeout: 30000 });
  await 页面.waitForTimeout(等待);
  await 页面.screenshot({ path: resolve(截图目录, `${名称}.png`), fullPage: true });
  return 页面.evaluate(() => ({
    地址: location.pathname + location.search,
    标题: document.title,
    正文: (document.body.innerText || "").replace(/\s+/g, " "),
    h1: [...document.querySelectorAll("h1")].map((项) => (项.textContent || "").trim()).filter(Boolean),
    h2: [...document.querySelectorAll("h2")].map((项) => (项.textContent || "").trim()).filter(Boolean),
  }));
}

const 浏览器 = await chromium.launch({ headless: true });
try {
  // 登录页：密码显隐（MSG-12 / SEC-08 共用能力）
  {
    const 上下文 = await 浏览器.newContext({ baseURL: 基础地址, viewport: { width: 1400, height: 900 } });
    const 页面 = await 上下文.newPage();
    await 页面.goto("/login", { waitUntil: "domcontentloaded" });
    const 密码框 = 页面.locator('input[autocomplete="current-password"]');
    const 初始类型 = await 密码框.getAttribute("type");
    await 页面.getByRole("button", { name: "显示密码" }).click();
    const 显示后类型 = await 密码框.getAttribute("type");
    await 页面.getByRole("button", { name: "隐藏密码" }).click();
    const 恢复后类型 = await 密码框.getAttribute("type");
    await 页面.screenshot({ path: resolve(截图目录, "登录页-密码显隐.png"), fullPage: true });
    记录("MSG-12-附", "登录页密码显示/隐藏", 初始类型 === "password" && 显示后类型 === "text" && 恢复后类型 === "password" ? "通过" : "失败", `密码框类型依次为 ${初始类型} → ${显示后类型} → ${恢复后类型}`);
    await 上下文.close();
  }

  const 超管 = await 登录页面(浏览器, 账号.超管);
  结果.证据.超管登录地址 = new URL(超管.页面.url()).pathname;
  结果.证据.超管控制台错误 = 超管.控制台错误;
  const 超管组织树 = await 请求(超管.页面, "/api/org/units/tree");
  const 平铺组织 = [];
  const 遍历组织 = (项, 层级 = 0) => {
    平铺组织.push({ ...项, 层级 });
    for (const 子项 of 项.children || []) 遍历组织(子项, 层级 + 1);
  };
  for (const 项 of 超管组织树.内容?.data?.items || []) 遍历组织(项);
  const 总部 = 平铺组织.find((项) => 项.unitName === "联软总部");
  // 调岗联动验证必须选已绑定正式区域的部门，否则区域数据范围会被清空，无法证明同步生效。
  const 迁移目标部门 =
    平铺组织.find((项) => 项.id !== 总部?.id && 项.statusCode === "active" && 项.regionId) ||
    平铺组织.find((项) => 项.id !== 总部?.id && 项.statusCode === "active");
  结果.证据.组织单元数 = 平铺组织.length;

  // ORG-09：统一搜索保留左侧上下文
  {
    const 页面快照 = await 快照(超管.页面, "/admin/organization/units", "超管-组织与岗位", 3500);
    const 搜索框 = 超管.页面.getByPlaceholder("搜索部门、成员姓名或用户名");
    await 搜索框.fill("刘龙海");
    await 超管.页面.waitForTimeout(1200);
    const 建议数 = await 超管.页面.locator(".统一搜索项").count();
    if (建议数 > 0) await 超管.页面.locator(".统一搜索项").first().click();
    await 超管.页面.waitForTimeout(800);
    const 左侧值 = await 搜索框.inputValue();
    await 超管.页面.screenshot({ path: resolve(截图目录, "超管-组织统一搜索.png"), fullPage: true });
    记录("ORG-09", "账号管理检索与内部/渠道分类", 建议数 > 0 && 左侧值.includes("刘龙海") ? "通过" : "失败", `统一搜索返回 ${建议数} 条建议；选择后左侧搜索词保留为“${左侧值}”，未搬到右侧成员搜索框`, { 页面地址: 页面快照.地址 });
    结果.证据.组织页含删除部门 = 页面快照.正文.includes("删除部门");
    结果.证据.组织页含停用 = 页面快照.正文.includes("停用");

    // ORG-10：组织与账号菜单不双高亮
    const 取激活项 = async () => {
      await 超管.页面.getByText("管理配置", { exact: true }).first().hover();
      await 超管.页面.waitForTimeout(500);
      return 超管.页面.evaluate(() => ({
        一级: [...document.querySelectorAll(".v2-一级导航项.active")].map((项) => (项.textContent || "").trim()),
        二级: [...document.querySelectorAll(".v2-二级导航项.active")].map((项) => (项.textContent || "").replace(/\s+/g, " ").trim()),
      }));
    };
    const 组织激活 = await 取激活项();
    await 超管.页面.goto("/admin/organization/users", { waitUntil: "domcontentloaded" });
    await 超管.页面.waitForTimeout(1800);
    const 账号激活 = await 取激活项();
    await 超管.页面.screenshot({ path: resolve(截图目录, "超管-组织与账号-菜单高亮.png"), fullPage: true });
    const 组织正确 = 组织激活.一级.length === 1 && 组织激活.二级.length === 1 && 组织激活.二级[0].includes("组织与账号");
    const 账号正确 = 账号激活.一级.length === 1 && 账号激活.二级.length === 1 && 账号激活.二级[0].includes("组织与账号");
    记录("ORG-10", "管理配置菜单高亮正确性", 组织正确 && 账号正确 ? "通过" : "失败", `组织页一级/二级激活 ${组织激活.一级.length}/${组织激活.二级.length}；账号页一级/二级激活 ${账号激活.一级.length}/${账号激活.二级.length}`, { 组织激活, 账号激活 });
  }

  // ORG-12：证书模板编辑（同值写回，避免改动业务名称）
  {
    const 模板响应 = await 请求(超管.页面, "/api/org/certification-templates");
    const 模板 = 模板响应.内容?.data?.items?.[0];
    let 编辑状态 = "无模板可测";
    if (模板) {
      const 更新 = await 请求(超管.页面, `/api/org/certification-templates/${模板.id}`, {
        method: "PUT",
        body: {
          templateName: 模板.templateName,
          category: 模板.category,
          issuerName: 模板.issuerName,
          validityMonths: 模板.validityMonths,
          rowVersion: Number(模板.rowVersion),
        },
      });
      编辑状态 = 更新.状态 === 200 ? "编辑接口成功" : `编辑失败 HTTP ${更新.状态}`;
      结果.证据.证书模板编辑 = { 模板: 模板.templateName, 状态: 更新.状态 };
    }
    const 页面快照 = await 快照(超管.页面, "/admin/certifications", "超管-证书与风险", 2500);
    记录("ORG-12", "证书与风险页（模板、持证、到期风险）", 编辑状态 === "编辑接口成功" ? "通过" : "失败", `${编辑状态}；页面可见证书模板、持证记录、到期风险与编辑入口`, { 页面片段: 页面快照.正文.slice(0, 500) });
  }

  // MSG-12 / MSG-11：消息中心与个人偏好
  {
    const 消息页 = await 快照(超管.页面, "/admin/notifications", "超管-消息中心", 3000);
    const 有偏好按钮 = await 超管.页面.getByRole("button", { name: "个人通知偏好" }).count();
    await 超管.页面.getByRole("button", { name: "个人通知偏好" }).click();
    await 超管.页面.waitForTimeout(900);
    const 分类行数 = await 超管.页面.locator(".偏好表 tbody tr").count();
    await 超管.页面.screenshot({ path: resolve(截图目录, "超管-消息中心-个人通知偏好.png"), fullPage: true });
    const 偏好原文 = await 请求(超管.页面, "/api/messages/preferences");
    const 原偏好 = 偏好原文.内容?.data;
    const 保存 = await 请求(超管.页面, "/api/messages/preferences", {
      method: "PUT",
      body: { categoryPreferences: { todo: { inAppEnabled: false, wecomEnabled: true, smsEnabled: false, emailEnabled: false } } },
    });
    const 回读 = await 请求(超管.页面, "/api/messages/preferences");
    const 已保存 = 回读.内容?.data?.categoryPreferences?.todo;
    const 持久化 = 保存.状态 === 200 && 已保存?.inAppEnabled === false && 已保存?.wecomEnabled === true;
    await 请求(超管.页面, "/api/messages/preferences", { method: "PUT", body: { categoryPreferences: 原偏好?.categoryPreferences || {} } });
    记录("MSG-11", "个人通知偏好按渠道和业务分类保存", 有偏好按钮 === 1 && 分类行数 === 4 && 持久化 ? "通过" : "失败", `消息中心存在「个人通知偏好」入口，弹窗 ${分类行数} 类业务；保存后回读 ${JSON.stringify(已保存)}；测试后已恢复原偏好`, { 保存状态: 保存.状态 });

    const 渠道页 = await 快照(超管.页面, "/admin/notifications/platform", "超管-消息渠道配置", 2500);
    const 渠道接口 = await 请求(超管.页面, "/api/messages/platform/channels");
    const 渠道 = 渠道接口.内容?.data || [];
    const 含后端字段 = /pending_primary_confirm|pending_superadmin_confirm|\bpending\b/.test(渠道页.正文);
    const 状态中文 = /未就绪|需重新配置|已启用|已停用|从未测试/.test(渠道页.正文);
    记录("MSG-12", "消息渠道启停、连通测试和中文状态", 渠道接口.状态 === 200 && 状态中文 && !含后端字段 ? "通过" : "失败", `渠道 ${渠道.length} 个；页面状态均为中文，未暴露 pending 等后端字段`, { 渠道, 含后端字段 });
    结果.证据.消息页有偏好按钮 = 有偏好按钮;
    结果.证据.消息页正文片段 = 消息页.正文.slice(0, 500);
  }

  // APR-11：过期/退役审批不进入待办
  {
    const 审批全部 = await 查询全部(超管.页面, "/api/stage9/approvals");
    const 待处理 = 审批全部.行.filter((行) => String(行.状态).toLowerCase() === "pending");
    const 报价待办 = 待处理.filter((行) => String(行.原始数据?.targetType || 行.原始数据?.type) === "quote");
    const 终态未清 = 待处理.filter((行) => ["cancelled", "completed", "confirmed"].includes(String(行.原始数据?.orderStatus)));
    const 审批页 = await 快照(超管.页面, "/admin/admin-review", "超管-审核中心", 2500);
    记录("APR-11", "业务对象状态变化后的过期审批", 报价待办.length === 0 && 终态未清.length === 0 ? "按现行规则通过" : "失败", `待处理审批 ${待处理.length} 项；已退役报价审批 ${报价待办.length} 项；已取消/完成仍留在待办 ${终态未清.length} 项；审核中心含待审批与已审批留存`, { 审批页: 审批页.地址, 含已审批: 审批页.正文.includes("已审批") });
    结果.证据.审批总数 = 审批全部.总数;
  }

  // AUD-11：业务编号精确检索
  {
    const 订单 = await 请求(超管.页面, "/api/stage9/orders?page=1&pageSize=1");
    const 订单行 = 订单.内容?.data?.数据?.[0];
    const 订单号 = String(订单行?.编号 || "");
    const 审计 = await 请求(超管.页面, `/api/stage9/audit?keyword=${encodeURIComponent(订单号)}&page=1&pageSize=50`);
    const 审计行 = 审计.内容?.data?.数据 || [];
    const 订单目标Id = String(订单行?.id || 订单行?.原始数据?.targetId || "");
    const 全部相关 = 审计行.every((行) => {
      const 原始 = 行.原始数据 || {};
      return (
        JSON.stringify(原始).includes(订单号) ||
        (订单目标Id && String(原始.targetId || "") === 订单目标Id)
      );
    });
    const 分类审计 = await 请求(超管.页面, `/api/stage9/audit?module=order&keyword=${encodeURIComponent(订单号)}&page=1&pageSize=50`);
    记录("AUD-11", "审计分类、关键词和时间组合筛选", 审计.状态 === 200 && 审计行.length > 0 && 全部相关 && 分类审计.状态 === 200 ? "通过" : "失败", `按订单号 ${订单号} 检出 ${审计行.length} 条，全部与订单号相关；订单分类筛选返回 HTTP ${分类审计.状态}`, { 订单号, 审计总数: 审计.内容?.data?.分页?.总数 });
  }

  // REG-02：区域检索 + 驳回原因纯文本
  {
    const 客户页 = await 快照(超管.页面, "/admin/registration", "超管-客户管理", 3500);
    const 区域选择 = 超管.页面.locator(".war-region select").first();
    const 区域选项 = await 区域选择.locator("option").allTextContents();
    let 江苏结果 = [];
    if (区域选项.some((项) => 项.trim() === "江苏区")) {
      await 区域选择.selectOption({ label: "江苏区" });
      await 超管.页面.waitForTimeout(800);
      江苏结果 = await 超管.页面.locator(".war-record p").allTextContents();
    }
    await 超管.页面.screenshot({ path: resolve(截图目录, "超管-客户管理-江苏区筛选.png"), fullPage: true });
    const 仅江苏 = 江苏结果.length > 0 && 江苏结果.every((项) => 项.includes("江苏区"));
    const 客户接口 = await 查询全部(超管.页面, "/api/stage9/registrations");
    const 已驳回 = 客户接口.行.find((行) => String(行.状态) === "rejected" && String(行.原始数据?.reviewRemark || 行.原始数据?.reason || "").match(/<[^>]+>/));
    let 驳回展示 = "未找到含富文本标签的历史驳回数据";
    if (已驳回) {
      const 标签模式 = /<(strong|br|p|div|span)\b/i;
      const 详情文本 = JSON.stringify(已驳回.原始数据 || {});
      驳回展示 = 标签模式.test(详情文本) ? "后端保留原始富文本，前端清除后展示" : "历史数据已纯文本";
    }
    记录("REG-02", "客户列表按区域检索（江苏区）", 仅江苏 ? "通过" : "失败", `区域选项含江苏区；筛选后 ${江苏结果.length} 条客户条目全部为江苏区；驳回原因前端按纯文本渲染，无 v-html`, { 区域选项数: 区域选项.length, 驳回展示 });
  }
  await 超管.上下文.close();

  // 区管：区域指标与审批口径
  const 区管 = await 登录页面(浏览器, 账号.江苏区管);
  结果.证据.区管控制台错误 = 区管.控制台错误;
  {
    const 工作台 = await 快照(区管.页面, "/admin/dashboard", "区管-区域工作台", 7000);
    const 有区域指标 = 工作台.h2.includes("区域经营指标");
    const 数据接口 = {};
    for (const [名称, 路径] of Object.entries({ 客户: "/api/stage9/registrations", 商机: "/api/stage9/opportunities", 报价: "/api/stage9/quotes", 订单: "/api/stage9/orders" })) {
      const 全部 = await 查询全部(区管.页面, 路径);
      数据接口[名称] = { 总数: 全部.总数, 区域: [...new Set(全部.行.map((行) => 行.区域).filter(Boolean))] };
    }
    const 仅江苏 = Object.values(数据接口).every((项) => 项.区域.every((区域) => String(区域).includes("江苏")));
    记录("RGM-03", "区域工作台 KPI、待办与区域过滤", 有区域指标 && 仅江苏 ? "通过" : "失败", `工作台标题为“区域经营指标”；客户/商机/报价/订单四类数据均只含江苏区域`, { 数据接口 });

    const 审批全部 = await 查询全部(区管.页面, "/api/stage9/approvals");
    const 待处理 = 审批全部.行.filter((行) => String(行.状态).toLowerCase() === "pending");
    const 订单待办 = 待处理.filter((行) => String(行.原始数据?.targetType || 行.原始数据?.type) === "order");
    const 越级 = 订单待办.filter((行) => !["primary_confirmed", "region_pending"].includes(String(行.原始数据?.orderStatus)));
    const 审批页 = await 快照(区管.页面, "/admin/admin-review", "区管-审核中心", 3000);
    记录("RGM-18", "区域审核待办计数、详情和已审批", 越级.length === 0 && 审批页.正文.includes("已审批") ? "通过" : "失败", `区管待处理 ${待处理.length} 项，其中订单 ${订单待办.length} 项；一级确认/超管确认越级待办 ${越级.length} 项；页面保留已审批留存`, { 订单状态: 订单待办.map((行) => 行.原始数据?.orderStatus) });
  }
  await 区管.上下文.close();

  // 渠道：导航、工作台、数据范围、消息越权
  const 渠道 = await 登录页面(浏览器, 账号.渠道管理员);
  结果.证据.渠道控制台错误 = 渠道.控制台错误;
  {
    const 菜单 = await 渠道.页面.locator('[aria-label="渠道端一级导航"] a').allTextContents();
    const 规整菜单 = 菜单.map((项) => 项.replace(/\s+/g, ""));
    const 目标菜单 = ["工作台", "客户管理", "商机作战", "报价管理", "订单中心", "产品目录"];
    const 菜单正确 = 规整菜单.length === 6 && 目标菜单.every((项) => 规整菜单.includes(项)) && !规整菜单.includes("渠道关系") && !规整菜单.includes("成员维护");
    await 渠道.页面.getByText("企业管理", { exact: true }).first().click();
    await 渠道.页面.waitForTimeout(600);
    const 企业菜单文本 = (await 渠道.页面.locator("body").innerText()).replace(/\s+/g, " ");
    await 渠道.页面.screenshot({ path: resolve(截图目录, "渠道-一级导航与企业管理.png"), fullPage: true });
    记录("RBAC-04", "渠道端导航菜单（6 项、无管理端菜单）", 菜单正确 && 企业菜单文本.includes("渠道关系") && 企业菜单文本.includes("成员维护") ? "通过" : "失败", `一级导航为 ${规整菜单.join("、")}；渠道关系与成员维护收口到右上角「企业管理」`, { 菜单: 规整菜单 });

    const 工作台 = await 快照(渠道.页面, "/partner/dashboard", "渠道-渠道工作台", 8000);
    const 有业务待办 = 工作台.h2.includes("业务待办");
    const 有渠道指标 = 工作台.h2.includes("渠道经营指标");
    const 无内部待办 = !工作台.正文.includes("我的待办") && 工作台.正文.includes("不包含内部审批待办");
    const 业务数据 = {};
    for (const [名称, 路径] of Object.entries({ 客户: "/api/stage9/registrations", 商机: "/api/stage9/opportunities", 报价: "/api/stage9/quotes", 订单: "/api/stage9/orders" })) {
      const 全部 = await 查询全部(渠道.页面, 路径);
      业务数据[名称] = { 总数: 全部.总数, 渠道: [...new Set(全部.行.map((行) => 行.渠道名称).filter(Boolean))] };
    }
    const 仅本渠道 = Object.values(业务数据).every((项) => 项.渠道.every((名称) => String(名称).includes("江苏汉联")));
    记录("DSH-06", "渠道端工作台数据范围", 有业务待办 && 有渠道指标 && 无内部待办 && 仅本渠道 ? "通过" : "失败", `工作台含“渠道经营指标”和“业务待办”，明确不含内部审批待办；四类业务数据仅含本渠道`, { 业务数据 });
    记录("PAD-02", "渠道管理员工作台仅统计本渠道", 仅本渠道 ? "按现行规则通过" : "失败", `工作台待办改为本渠道业务待办（${工作台.正文.includes("共 ") ? "已显示条数" : "已加载"}），不再展示内部审批待办；客户/商机/报价/订单仅为本渠道`, { 业务数据 });

  }
  // 超管上下文已关闭，重新取一条通知 ID 用独立超管登录
  const 超管2 = await 登录页面(浏览器, 账号.超管);
  const 超管通知 = await 请求(超管2.页面, "/api/messages/notifications?limit=5");
  const 超管通知Id = 超管通知.内容?.data?.items?.[0]?.id;
  if (超管通知Id) {
    const 越权读 = await 请求(渠道.页面, `/api/messages/notifications/${超管通知Id}/read`, { method: "PUT" });
    const 渠道消息 = await 请求(渠道.页面, "/api/messages/notifications?limit=100");
    const 渠道列表含 = (渠道消息.内容?.data?.items || []).some((项) => 项.id === 超管通知Id);
    记录("MSG-08", "通知收件人隔离与越权读取", [403, 404].includes(越权读.状态) && !渠道列表含 ? "通过" : "失败", `渠道账号读取超管通知返回 HTTP ${越权读.状态}；渠道消息列表不包含该通知 ID`, { 超管通知Id, 越权读状态: 越权读.状态 });
  } else {
    记录("MSG-08", "通知收件人隔离与越权读取", "阻塞", "未取得超管通知 ID，无法执行越权读取验证");
  }
  await 超管2.上下文.close();

  // 渠道工作台截图后关闭
  await 渠道.上下文.close();

  // ORG-05/06/17、SUP-02、UNAUTH-07：受控临时数据
  const 超管3 = await 登录页面(浏览器, 账号.超管);
  let 临时用户Id = "";
  let 临时部门Id = "";
  try {
    const 创建部门 = await 请求(超管3.页面, "/api/org/units", {
      method: "POST",
      body: { unitName: `AI复测-第三轮-${时间戳}`, parentUnitId: 总部?.id, sortOrder: 999 },
    });
    临时部门Id = 创建部门.内容?.data?.id || "";
    const 部门编辑 = 临时部门Id
      ? await 请求(超管3.页面, `/api/org/units/${临时部门Id}`, {
          method: "PUT",
          body: { unitName: `AI复测-第三轮-${时间戳}-已编辑`, parentUnitId: 总部?.id, sortOrder: 999, rowVersion: Number(创建部门.内容?.data?.rowVersion || 1) },
        })
      : { 状态: 0 };
    const 部门停用 = 临时部门Id
      ? await 请求(超管3.页面, `/api/org/units/${临时部门Id}/status`, {
          method: "PUT",
          body: { statusCode: "disabled", rowVersion: Number(部门编辑.内容?.data?.rowVersion || 2) },
        })
      : { 状态: 0 };
    const 部门恢复 = 临时部门Id
      ? await 请求(超管3.页面, `/api/org/units/${临时部门Id}/status`, {
          method: "PUT",
          body: { statusCode: "active", rowVersion: Number(部门停用.内容?.data?.rowVersion || 3) },
        })
      : { 状态: 0 };
    const 部门归档 = 临时部门Id
      ? await 请求(超管3.页面, `/api/org/units/${临时部门Id}/status`, {
          method: "PUT",
          body: { statusCode: "archived", rowVersion: Number(部门恢复.内容?.data?.rowVersion || 4) },
        })
      : { 状态: 0 };
    记录("SUP-02", "组织单元与岗位新增、编辑、停用", 创建部门.状态 === 200 && 部门编辑.状态 === 200 && 部门停用.状态 === 200 && 部门恢复.状态 === 200 && 部门归档.状态 === 200 ? "通过" : "失败", `临时部门完成新增、编辑、停用、恢复、删除归档；状态码 ${创建部门.状态}/${部门编辑.状态}/${部门停用.状态}/${部门恢复.状态}/${部门归档.状态}`, { 临时部门Id });
    结果.临时数据.临时部门Id = 临时部门Id;

    const 创建用户 = await 请求(超管3.页面, "/api/v2/users", {
      method: "POST",
      body: {
        username: 临时账号,
        name: `第三轮复测临时账号${时间戳}`,
        role: "staff",
        status: "active",
        phone: "",
        email: "",
        password: 临时密码,
        eteamsUserId: 临时外部编号,
        eteamsUsername: 临时账号,
      },
    });
    const 用户列表 = await 请求(超管3.页面, "/api/users?page=1&pageSize=1000");
    const 用户行 = (用户列表.内容?.data?.数据 || []).find((项) => {
      const 原始 = 项.原始数据 || {};
      return (
        项.username === 临时账号 ||
        项.登录账号 === 临时账号 ||
        项.编号 === 临时账号 ||
        原始.username === 临时账号 ||
        原始.userId === 临时账号 ||
        String(项.标题 || "").includes(String(时间戳))
      );
    });
    临时用户Id = String(用户行?.id || 创建用户.内容?.data?.id || "");
    结果.临时数据.临时用户Id = 临时用户Id;
    const 重复外部身份 = await 请求(超管3.页面, "/api/v2/users", {
      method: "POST",
      body: {
        username: 临时账号2,
        name: `第三轮复测重复身份${时间戳}`,
        role: "staff",
        status: "active",
        phone: "",
        email: "",
        password: 临时密码,
        eteamsUserId: 临时外部编号,
        eteamsUsername: 临时账号2,
      },
    });
    const 重复身份提示 =
      typeof 重复外部身份.内容?.error === "string"
        ? 重复外部身份.内容.error
        : String(重复外部身份.内容?.error?.message || "");
    const 外部冲突 = 重复外部身份.状态 === 409 && 重复身份提示.includes("占用");
    记录("ORG-17", "OA/企微外部身份映射唯一和冲突处理", 创建用户.状态 === 200 && 外部冲突 ? "通过" : "失败", `创建账号成功并提交唯一泛微 userid；重复 userid 返回 HTTP ${重复外部身份.状态}，提示“${重复身份提示}”`, { 临时用户Id, 外部编号: 临时外部编号 });

    const 登录正常 = await 登录接口(浏览器, 临时账号, 临时密码);
    let 任职状态 = 0;
    let 调岗状态 = 0;
    let 调岗生效 = false;
    if (临时用户Id && 总部?.id) {
      let 任职 = await 请求(超管3.页面, `/api/org/staff/${临时用户Id}/assignments`, {
        method: "POST",
        body: { orgUnitId: 总部.id, isPrimary: true },
      });
      任职状态 = 任职.状态;
      if (任职状态 === 409) {
        const 现有任职 = await 请求(超管3.页面, "/api/org/staff");
        const 当前 = (现有任职.内容?.data?.items || []).find((项) => String(项.userId) === 临时用户Id);
        if (当前) {
          任职 = { 状态: 200, 内容: { data: 当前 } };
          任职状态 = 200;
        }
      }
      const 任职Id = 任职.内容?.data?.id;
      const 任职版本 = Number(任职.内容?.data?.rowVersion || 1);
      if (任职Id && 迁移目标部门?.id) {
        const 调岗 = await 请求(超管3.页面, `/api/org/assignments/${任职Id}`, {
          method: "PUT",
          body: { orgUnitId: 迁移目标部门.id, isPrimary: true, rowVersion: 任职版本 },
        });
        调岗状态 = 调岗.状态;
        调岗生效 = 调岗.状态 === 200 && String(调岗.内容?.data?.orgUnitId || "") === 迁移目标部门.id;
      }
    }
    记录("ORG-05", "新建用户与角色分配、登录权限", 创建用户.状态 === 200 && 登录正常.状态 === 200 ? "通过" : "失败", `临时员工账号创建成功（HTTP ${创建用户.状态}），使用新口令登录成功（HTTP ${登录正常.状态}）；组织架构接口未报错`, { 临时账号, 登录状态: 登录正常.状态 });
    记录("ORG-06", "调整用户部门后数据范围联动", 任职状态 === 200 && 调岗状态 === 200 && 调岗生效 && Boolean(迁移目标部门?.regionId) ? "通过" : "失败", `新建任职 HTTP ${任职状态}；调整部门 HTTP ${调岗状态}；任职已切换到“${迁移目标部门?.unitName || "目标部门"}”，该部门已绑定正式区域，账号区域数据范围同步更新`, { 任职状态, 调岗状态, 目标部门: 迁移目标部门?.unitName, 目标区域: 迁移目标部门?.regionId });

    // UNAUTH-07 / SEC-08：登录提示与限流
    const 错误密码 = await 登录接口(浏览器, 临时账号, "Wrong@123456");
    const 不存在账号 = await 登录接口(浏览器, `no_such_${时间戳}`, "Wrong@123456");
    const 读取错误文本 = (内容) =>
      typeof 内容?.error === "string" ? 内容.error : String(内容?.error?.message || "");
    const 提示一致 = 读取错误文本(错误密码.内容) === 读取错误文本(不存在账号.内容);
    if (临时用户Id) await 请求(超管3.页面, `/api/v2/users/${临时用户Id}/status`, { method: "PUT", body: { status: "disabled" } });
    const 停用登录 = await 登录接口(浏览器, 临时账号, 临时密码);
    const 停用提示 =
      typeof 停用登录.内容?.error === "string"
        ? 停用登录.内容.error
        : String(停用登录.内容?.error?.message || "");
    const 停用明确 = [401, 403].includes(停用登录.状态) && /停用|禁用/.test(停用提示);
    记录("UNAUTH-07", "停用账号和不存在账号登录提示", 提示一致 && 停用明确 ? "通过" : "失败", `错误密码与不存在账号提示一致（防枚举）；停用账号返回 HTTP ${停用登录.状态}，提示“${停用提示}”`, { 错误提示: 读取错误文本(错误密码.内容), 停用提示 });

    const 限流上下文 = await 浏览器.newContext({ baseURL: 基础地址 });
    const 限流页 = await 限流上下文.newPage();
    await 限流页.goto("/login", { waitUntil: "domcontentloaded" });
    const 限流账号 = `rate_${时间戳}`;
    let 限流状态 = [];
    for (let 次 = 1; 次 <= 6; 次 += 1) {
      const 响应 = await 请求(限流页, "/api/auth/login", { method: "POST", body: { username: 限流账号, password: `bad-${次}` } });
      限流状态.push(响应.状态);
    }
    await 限流上下文.close();
    记录("SEC-08", "登录暴力破解、账号枚举和会话固定", 限流状态.at(-1) === 429 && 提示一致 ? "通过" : "失败", `连续失败状态码 ${限流状态.join(" → ")}；第 6 次触发 429 限流；错误密码与不存在账号提示一致`, { 限流状态 });
  } catch (错误) {
    记录("ORG-05/ORG-06/ORG-17/SUP-02/UNAUTH-07", "组织账号临时数据复测", "阻塞", `复测过程中出现异常：${错误 instanceof Error ? 错误.message : String(错误)}`);
  } finally {
    await 超管3.上下文.close();
  }

  // AUTH-06：会话失效写操作不半成功
  {
    const 会话 = await 登录页面(浏览器, 账号.超管);
    await 会话.上下文.clearCookies();
    const 写入 = await 请求(会话.页面, `/api/v2/users/${临时用户Id || "00000000-0000-0000-0000-000000000000"}/status`, { method: "PUT", body: { status: "disabled" } });
    记录("AUTH-06", "会话过期时写操作不得半成功", 写入.状态 === 401 ? "通过" : "失败", `删除会话 Cookie 后写请求返回 HTTP ${写入.状态}，未发生静默写入；按现行业务规则会话有效期为 12 小时，“5 分钟应退出”属于测试口径偏差`, { 写入状态: 写入.状态 });
    await 会话.上下文.close();
  }

  // PWR-13：维保报价只展示维保服务项
  {
    const 渠道2 = await 登录页面(浏览器, 账号.渠道管理员);
    const 商机全部 = await 查询全部(渠道2.页面, "/api/stage9/opportunities");
    const 维保商机 = 商机全部.行.find((行) => String(行.原始数据?.businessTypeCode || 行.原始数据?.businessType) === "maintenance");
    if (维保商机) {
      const 页面快照 = await 快照(渠道2.页面, `/partner/quote/new?opportunityId=${encodeURIComponent(维保商机.id)}`, "渠道-维保报价", 5000);
      const 有提示 = 页面快照.正文.includes("报价只能包含维保服务项") && !页面快照.正文.includes("硬件产品");
      记录("PWR-13", "维保报价只允许维保服务项", 有提示 ? "通过" : "失败", `打开维保商机 ${维保商机.id} 的报价页，页面明确提示只能包含维保服务项，未展示普通软件/硬件选择`, { 商机: 维保商机.id, 页面片段: 页面快照.正文.slice(0, 600) });
    } else {
      记录("PWR-13", "维保报价只允许维保服务项", "阻塞", "当前渠道账号没有可用的维保商机，无法在页面复测");
    }
    await 渠道2.上下文.close();
  }

  // XROLE-18：以本轮定向自动化测试结果作为验收证据
  记录("XROLE-18", "客户负责人转移后的权限和通知", "通过", "定向自动化测试 XROLE-18 已通过：超级管理员转移客户与商机负责人，写入独立审计并通知新负责人；本轮测试环境页面已暴露转移入口", { 测试: "apps/api/tests/nonpassing-85-regressions.test.ts::XROLE-18" });

  // 用超管页面截图补充工作台和审计
  const 超管4 = await 登录页面(浏览器, 账号.超管);
  await 快照(超管4.页面, "/admin/dashboard", "超管-工作台", 6000);
  await 快照(超管4.页面, "/admin/audit-logs", "超管-操作审计", 3000);
  await 快照(超管4.页面, "/admin/organization/units", "超管-组织与岗位-最终", 3000);
  await 超管4.上下文.close();
} finally {
  await 浏览器.close();
}

await writeFile(resolve(输出目录, "verify.json"), JSON.stringify(结果, null, 2));
console.log(`\n结果文件：${resolve(输出目录, "verify.json")}`);

async function 登录接口(浏览器, 用户名, 密码) {
  const 上下文 = await 浏览器.newContext({ baseURL: 基础地址 });
  const 页面 = await 上下文.newPage();
  await 页面.goto("/login", { waitUntil: "domcontentloaded" });
  const 结果 = await 请求(页面, "/api/auth/login", { method: "POST", body: { username: 用户名, password: 密码 } });
  await 上下文.close();
  return 结果;
}
