<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  type 业务角色,
  type 任职,
  type 企业微信同步状态,
  创建业务角色,
  创建任职,
  创建用户,
  创建组织,
  创建证书模板,
  type 同步差异,
  type 同步批次,
  导入成员,
  导入部门,
  导出成员,
  导出部门,
  type 岗位,
  type 成员业务角色,
  type 成员证书,
  type 泛微OA身份详情,
  type 泛微OA身份候选,
  指派成员业务角色,
  type 接口对象,
  撤销证书 as 撤销证书API,
  更新用户,
  查询业务角色,
  查询任职,
  查询企微同步差异,
  查询企微同步批次,
  查询岗位,
  查询成员业务角色,
  查询成员证书,
  查询离职交接,
  查询证书模板,
  查询负责人关系,
  生成组织幂等键,
  type 离职交接单,
  type 组织单元,
  组织接口错误,
  type 组织状态,
  结束任职 as 结束任职API,
  结束成员业务角色,
  type 证书模板,
  读取企微同步状态,
  读取渠道组织树,
  读取用户列表,
  读取组织树,
  读取组织状态,
  读取泛微OA身份,
  type 负责人关系,
  创建泛微OA身份候选,
  更新泛微OA身份候选,
  确认泛微OA身份候选,
  驳回泛微OA身份候选,
  停用泛微OA身份,
  type 账号台账行,
  重置用户密码,
  颁发证书 as 颁发证书API,
} from "../../../api/organization-client.js";

type 页面栏目 =
  | "units"
  | "staff"
  | "business-roles"
  | "certifications"
  | "offboarding"
  | "directory-sync"
  | "access";
type 新建类型 = "unit" | "position" | "businessRole" | "certificationTemplate";

interface 导航项 {
  栏目: 页面栏目;
  名称: string;
  路径: string;
}

interface 树节点数据 extends 接口对象 {
  id: string;
  label: string;
  status: string;
  members: 接口对象[];
  children?: 树节点数据[];
}

interface 成员概要 extends 接口对象 {
  assignmentId: string;
  userId: string;
  username: string;
  displayName: string;
  isPrimary: boolean;
  positionName: string;
  effectiveAt: string;
  expiredAt: string | null;
  直属负责人: string;
  证书: 成员证书[];
}

interface 渠道成员概要 extends 接口对象 {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

interface 编辑账号状态 extends 接口对象 {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  phone?: string;
  email?: string;
  bigRegion?: string;
  region?: string;
  remark?: string;
  createdAt?: string;
}

const 路由 = useRoute();
const 路由器 = useRouter();
const 加载中 = ref(true);
const 提交中 = ref(false);
const 移动访问 = ref(false);
const 已启动桌面数据加载 = ref(false);
const 错误提示 = ref("");
const 同步错误提示 = ref("");
const 组织功能状态 = ref<组织状态 | null>(null);
const 组织树 = ref<组织单元[]>([]);
const 渠道组织树 = ref<Array<接口对象 & { children?: 接口对象[]; members?: 接口对象[] }>>([]);
const 岗位列表 = ref<岗位[]>([]);
const 任职列表 = ref<任职[]>([]);
const 业务角色列表 = ref<业务角色[]>([]);
const 负责人关系列表 = ref<负责人关系[]>([]);
const 成员业务角色列表 = ref<成员业务角色[]>([]);
const 证书模板列表 = ref<证书模板[]>([]);
const 成员证书列表 = ref<成员证书[]>([]);
const 离职交接列表 = ref<离职交接单[]>([]);
const 企微同步状态 = ref<企业微信同步状态 | null>(null);
const 同步批次列表 = ref<同步批次[]>([]);
const 同步差异列表 = ref<同步差异[]>([]);
const 部门文件输入 = ref<HTMLInputElement | null>(null);
const 成员文件输入 = ref<HTMLInputElement | null>(null);
const 部门树引用 = ref<{
  filter: (值: string) => void;
  setCurrentKey: (键: string) => void;
} | null>(null);
const 部门搜索词 = ref("");
const 成员搜索词 = ref("");
const 选中部门Id = ref<string | null>(null);
const 渠道树引用 = ref<{ filter: (值: string) => void } | null>(null);
const 渠道搜索词 = ref("");
const 渠道成员搜索词 = ref("");
const 选中渠道Id = ref<string | null>(null);
const 新建弹窗打开 = ref(false);
const 当前新建类型 = ref<新建类型>("unit");

const 账号列表 = ref<账号台账行[]>([]);
const 账号检索词 = ref("");
const 账号检索结果 = ref<账号台账行[]>([]);
const 账号检索中 = ref(false);
const 新建用户弹窗打开 = ref(false);
const 编辑抽屉打开 = ref(false);
const 编辑用户 = ref<编辑账号状态 | null>(null);
const 编辑用户任职 = ref<任职[]>([]);
const 编辑用户业务角色 = ref<成员业务角色[]>([]);
const 编辑用户证书 = ref<成员证书[]>([]);
const 泛微OA身份 = ref<泛微OA身份详情 | null>(null);
const 基本信息表单 = reactive({ name: "", phone: "", email: "", status: "active" });
const 泛微候选表单 = reactive<{
  externalSubject: string;
  externalUsername: string;
  sourceCode: "manual" | "eteams_directory";
}>({ externalSubject: "", externalUsername: "", sourceCode: "manual" });
const 新任职表单 = reactive({ orgUnitId: "", positionId: "", isPrimary: false });
const 新业务角色表单 = reactive({ businessRoleId: "" });
const 新证书表单 = reactive({ certificationTemplateId: "", certificateNo: "", expiresOn: "" });
const 新建用户表单 = reactive({
  username: "",
  name: "",
  phone: "",
  email: "",
  password: "123456",
  status: "active",
  role: "staff",
  bigRegion: "",
  region: "",
  orgUnitId: "",
  isPrimary: true,
  positionId: "",
  businessRoleIds: [] as string[],
  certificationTemplateId: "",
  certificateExpiresOn: "",
});

const 大区列表 = [
  { label: "大东区", regions: ["安徽区", "江苏区", "上海区（非金）", "浙赣区"] },
  { label: "大南区", regions: ["深圳区", "广州区", "湖南区", "湖北区"] },
  { label: "西区", regions: ["西区"] },
  { label: "大北区", regions: ["北区（政府企业）", "河南区", "东北区", "山东区", "晋冀区"] },
];

const 导航项列表: 导航项[] = [
  { 栏目: "units", 名称: "组织与岗位", 路径: "/workspace/admin/platform-admin/organization/units" },
  { 栏目: "staff", 名称: "人员与任职", 路径: "/workspace/admin/platform-admin/organization/staff" },
  {
    栏目: "business-roles",
    名称: "业务角色",
    路径: "/workspace/admin/platform-admin/organization/business-roles",
  },
  {
    栏目: "certifications",
    名称: "证书管理",
    路径: "/workspace/admin/platform-admin/organization/certifications",
  },
  {
    栏目: "access",
    名称: "权限与范围",
    路径: "/workspace/admin/platform-admin/organization/data-scopes",
  },
  {
    栏目: "offboarding",
    名称: "离职交接",
    路径: "/workspace/admin/platform-admin/organization/offboarding",
  },
  {
    栏目: "directory-sync",
    名称: "企微同步",
    路径: "/workspace/admin/platform-admin/organization/directory-sync",
  },
];

const 新建表单 = reactive({
  unitCode: "",
  unitName: "",
  unitType: "department",
  parentUnitId: "",
  sortOrder: 0,
  orgUnitId: "",
  positionCode: "",
  positionName: "",
  positionCategory: "other",
  roleCode: "",
  roleName: "",
  domainCode: "internal",
  roleCategory: "other",
  templateCode: "",
  templateName: "",
  templateCategory: "other",
  issuerName: "",
  validityMonths: undefined as number | undefined,
});

const 当前栏目 = computed<页面栏目>(() => (路由.meta.组织栏目 as 页面栏目 | undefined) || "units");
const 当前导航 = computed(
  () =>
    导航项列表.find((item) => item.栏目 === 当前栏目.value) ?? {
      栏目: "units" as const,
      名称: "组织与岗位",
      路径: "/workspace/admin/platform-admin/organization/units",
    },
);
const 已启用 = computed(() => 组织功能状态.value?.enabled === true);
const 可写 = computed(() => 已启用.value && 组织功能状态.value?.writeEnabled === true);
const 平铺组织列表 = computed(() => 展开组织树(组织树.value));
const _平铺渠道组织列表 = computed(() => 展开渠道树(渠道组织树.value));
const 树节点属性 = { label: "label", children: "children" };
const 树数据 = computed<树节点数据[]>(() => 组织树.value.map(构建树节点));
const 平铺树数据 = computed(() => 展开树数据(树数据.value));
const 渠道树数据 = computed<树节点数据[]>(() => 渠道组织树.value.map(构建渠道树节点));
const _平铺渠道树数据 = computed(() => 展开树数据(渠道树数据.value));
const 证书按用户 = computed(() => {
  const 分组 = new Map<string, 成员证书[]>();
  for (const 证 of 成员证书列表.value) {
    if (!分组.has(证.userId)) 分组.set(证.userId, []);
    分组.get(证.userId)!.push(证);
  }
  return 分组;
});
const 当前部门名称 = computed(() => {
  const 节点 = 查找树节点(树数据.value, 选中部门Id.value);
  return 节点 ? 节点.label : "组织架构";
});
const 当前部门成员 = computed(() => {
  if (!选中部门Id.value) return [];
  const 节点 = 查找树节点(树数据.value, 选中部门Id.value);
  if (!节点) return [];
  return (节点.members || []).map(组装成员概要);
});
const 过滤后成员 = computed(() => {
  const 词 = 成员搜索词.value.trim().toLowerCase();
  if (!词) return 当前部门成员.value;
  return 当前部门成员.value.filter(
    (成员) =>
      String(成员.displayName || "")
        .toLowerCase()
        .includes(词) ||
      String(成员.username || "")
        .toLowerCase()
        .includes(词),
  );
});
const 当前渠道名称 = computed(() => {
  const 节点 = 查找树节点(渠道树数据.value, 选中渠道Id.value);
  return 节点 ? 节点.label : "渠道组织";
});
const 当前渠道成员 = computed<渠道成员概要[]>(() => {
  if (!选中渠道Id.value) return [];
  const 节点 = 查找树节点(渠道树数据.value, 选中渠道Id.value);
  if (!节点) return [];
  return (节点.members || []).map(组装渠道成员概要);
});
const 过滤后渠道成员 = computed(() => {
  const 词 = 渠道成员搜索词.value.trim().toLowerCase();
  if (!词) return 当前渠道成员.value;
  return 当前渠道成员.value.filter(
    (成员) =>
      String(成员.displayName || "")
        .toLowerCase()
        .includes(词) ||
      String(成员.username || "")
        .toLowerCase()
        .includes(词),
  );
});

function 展开渠道树(
  节点: Array<接口对象 & { children?: 接口对象[] }>,
  层级 = 0,
): Array<接口对象 & { 层级: number; 渠道名称: string; 渠道级别: string }> {
  return 节点.flatMap((节点项) => [
    {
      ...节点项,
      层级,
      渠道名称: String(节点项.partnerName || ""),
      渠道级别: String(节点项.partnerLevelCode || ""),
    },
    ...展开渠道树(节点项.children || [], 层级 + 1),
  ]);
}
const 直属负责人映射 = computed(
  () =>
    new Map(
      负责人关系列表.value
        .filter((关系) => 关系.relationType === "direct" && !关系.expiredAt)
        .map((关系) => [关系.subordinateAssignmentId, 关系.managerDisplayName || "—"]),
    ),
);
const 业务角色持有人数量 = computed(() => {
  const 结果 = new Map<string, number>();
  for (const 成员角色 of 成员业务角色列表.value) {
    if (!成员角色.expiredAt) {
      结果.set(成员角色.businessRoleId, (结果.get(成员角色.businessRoleId) || 0) + 1);
    }
  }
  return 结果;
});
const 近期到期数 = computed(
  () =>
    成员证书列表.value.filter((item) => {
      if (!item.expiresOn || item.statusCode !== "active") return false;
      const 剩余毫秒 = new Date(item.expiresOn).getTime() - Date.now();
      return 剩余毫秒 >= 0 && 剩余毫秒 <= 7 * 24 * 60 * 60 * 1000;
    }).length,
);
const 已过期数 = computed(
  () =>
    成员证书列表.value.filter(
      (item) => item.expiresOn && new Date(item.expiresOn).getTime() < Date.now(),
    ).length,
);

function 展开组织树(节点: 组织单元[], 层级 = 0): Array<组织单元 & { 层级: number }> {
  return 节点.flatMap((节点项) => [
    { ...节点项, 层级 },
    ...展开组织树(节点项.children || [], 层级 + 1),
  ]);
}

function 展开树数据(节点们: 树节点数据[], 层级 = 0): Array<树节点数据 & { 层级: number }> {
  return 节点们.flatMap((节点) => [
    { ...节点, 层级 },
    ...展开树数据(节点.children || [], 层级 + 1),
  ]);
}

function 构建渠道树节点(单元: 接口对象): 树节点数据 {
  return {
    id: String(单元.id),
    label: String(单元.partnerName || 单元.partnerCode || "渠道商"),
    status: String(单元.statusCode || ""),
    members: (单元.members || []) as 接口对象[],
    children: ((单元.children || []) as 接口对象[]).map(构建渠道树节点),
  };
}

function 定位部门(id: string) {
  if (!id) return;
  选中部门Id.value = id;
  const 节点 = 查找树节点(树数据.value, id);
  if (节点) 部门树引用.value?.setCurrentKey?.(id);
}

function 渠道节点成员数(节点: 树节点数据): number {
  const 直属 = (节点.members || []).length;
  const 子孙 = (节点.children || []).reduce((合计, 子节点) => 合计 + 渠道节点成员数(子节点), 0);
  return 直属 + 子孙;
}

function 过滤渠道节点(值: string, 数据: 树节点数据) {
  return !值 || String(数据.label).includes(值);
}

function 选择渠道(节点: 树节点数据) {
  选中渠道Id.value = 节点.id;
}

function 组装渠道成员概要(成员: 接口对象): 渠道成员概要 {
  const isAdmin = String(成员.memberRoleCode || "") === "partner_admin";
  return {
    ...成员,
    id: String(成员.id || 成员.username),
    displayName: String(成员.displayName || ""),
    username: String(成员.username || ""),
    isAdmin,
  };
}

function 构建树节点(单元: 组织单元): 树节点数据 {
  return {
    id: 单元.id,
    label: 单元.unitName,
    status: 单元.statusCode,
    members: (单元 as 组织单元 & { members?: 接口对象[] }).members || [],
    children: (单元.children || []).map(构建树节点),
  };
}

function 查找树节点(节点们: 树节点数据[], id: string | null): 树节点数据 | null {
  if (!id) return null;
  for (const 节点 of 节点们) {
    if (节点.id === id) return 节点;
    const 子节点 = 查找树节点(节点.children || [], id);
    if (子节点) return 子节点;
  }
  return null;
}

function 节点成员数(节点: 树节点数据): number {
  const 直属 = (节点.members || []).length;
  const 子孙 = (节点.children || []).reduce((合计, 子节点) => 合计 + 节点成员数(子节点), 0);
  return 直属 + 子孙;
}

function 选择部门(节点: 树节点数据) {
  选中部门Id.value = 节点.id;
}

function 组装成员概要(成员: 接口对象): 成员概要 {
  const 任职 = 任职列表.value.find((项) => 项.id === 成员.assignmentId);
  return {
    ...成员,
    assignmentId: String(成员.assignmentId),
    userId: String(成员.userId || ""),
    username: String(成员.username || ""),
    displayName: String(成员.displayName || ""),
    isPrimary: 任职?.isPrimary ?? false,
    positionName: 任职?.positionName || "",
    effectiveAt: 任职?.effectiveAt || "",
    expiredAt: 任职?.expiredAt || null,
    直属负责人: 直属负责人映射.value.get(String(成员.assignmentId)) || "",
    证书: 证书按用户.value.get(String(成员.userId || "")) || [],
  };
}

function 过滤部门节点(值: string, 数据: 树节点数据) {
  return !值 || String(数据.label).includes(值);
}

function 证书状态类型(证: 成员证书): "info" | "success" | "danger" | "warning" {
  if (证.statusCode !== "active") return "info";
  if (!证.expiresOn) return "success";
  const 剩余毫秒 = new Date(证.expiresOn).getTime() - Date.now();
  if (剩余毫秒 < 0) return "danger";
  if (剩余毫秒 <= 7 * 24 * 60 * 60 * 1000) return "warning";
  return "success";
}

function 证书详情(证: 成员证书) {
  return `${证.templateName}｜颁发：${证.issuedOn || "—"}｜到期：${证.expiresOn || "长期有效"}｜${
    证.statusCode === "active" ? "有效" : "已撤销"
  }`;
}

function 读取错误信息(error: unknown, 默认信息: string) {
  return error instanceof Error ? error.message : 默认信息;
}

function 同步访问终端() {
  移动访问.value = typeof window !== "undefined" && window.innerWidth < 900;
}

function 按访问终端加载页面() {
  同步访问终端();
  if (移动访问.value || 已启动桌面数据加载.value) return;

  已启动桌面数据加载.value = true;
  void 加载页面();
}

async function 加载页面() {
  加载中.value = true;
  错误提示.value = "";
  同步错误提示.value = "";
  try {
    const 状态 = await 读取组织状态();
    组织功能状态.value = 状态;
    if (!状态.enabled) return;

    const [组织, 岗位, 任职, 负责人关系, 角色, 成员角色, 模板, 证书, 离职] = await Promise.all([
      读取组织树(),
      查询岗位(),
      查询任职(),
      查询负责人关系(),
      查询业务角色(),
      查询成员业务角色(),
      查询证书模板(),
      查询成员证书(),
      查询离职交接(),
    ]);
    组织树.value = 组织.items;
    try {
      渠道组织树.value = (await 读取渠道组织树()).items;
    } catch {
      渠道组织树.value = [];
    }
    岗位列表.value = 岗位.items;
    任职列表.value = 任职.items;
    负责人关系列表.value = 负责人关系.items;
    业务角色列表.value = 角色.items;
    成员业务角色列表.value = 成员角色.items;
    证书模板列表.value = 模板.items;
    成员证书列表.value = 证书.items;
    离职交接列表.value = 离职.items;
    加载账号列表();

    if (状态.directorySyncEnabled) {
      try {
        const [同步状态, 批次, 差异] = await Promise.all([
          读取企微同步状态(),
          查询企微同步批次({ pageSize: 10 }),
          查询企微同步差异(),
        ]);
        企微同步状态.value = 同步状态;
        同步批次列表.value = 批次.items;
        同步差异列表.value = 差异.items;
      } catch (error) {
        同步错误提示.value = 读取错误信息(error, "企微同步状态读取失败，请稍后重试。");
      }
    }
  } catch (error) {
    if (error instanceof 组织接口错误 && error.错误码 === "ORG_PERMISSION_DENIED") {
      await 路由器.replace("/403");
      return;
    }
    错误提示.value = 读取错误信息(error, "组织架构数据读取失败，请稍后重试。");
  } finally {
    加载中.value = false;
  }
}

function 触发文件选择(类型: "部门" | "成员") {
  const 输入 = 类型 === "部门" ? 部门文件输入.value : 成员文件输入.value;
  输入?.click();
}

function 解析Excel工作簿(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const 数据 = event.target?.result;
        if (!(数据 instanceof ArrayBuffer)) {
          reject(new Error("文件读取失败。"));
          return;
        }
        const workbook = XLSX.read(new Uint8Array(数据), { type: "array" });
        const 表名 = workbook.SheetNames[0];
        if (!表名) {
          reject(new Error("Excel 未包含有效工作表。"));
          return;
        }
        resolve(XLSX.utils.sheet_to_json(workbook.Sheets[表名], { defval: "" }));
      } catch (error) {
        reject(
          new Error("Excel 解析失败：" + (error instanceof Error ? error.message : String(error))),
        );
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.readAsArrayBuffer(file);
  });
}

function 导出工作簿(
  表头: string[],
  行数据: (string | number)[][],
  文件名: string,
  工作表名: string,
) {
  const worksheet = XLSX.utils.aoa_to_sheet([表头, ...行数据]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 工作表名);
  XLSX.writeFile(workbook, 文件名);
}

async function 导出部门Excel() {
  try {
    const 结果 = await 导出部门();
    导出工作簿(
      ["部门名称", "上级部门", "排序", "状态"],
      结果.items.map((item) => [
        item.name,
        item.parentName || "",
        item.sortOrder ?? 0,
        item.statusCode,
      ]),
      "组织架构-部门导出.xlsx",
      "部门",
    );
  } catch (error) {
    ElMessage.error(读取错误信息(error, "部门导出失败。"));
  }
}

async function 导出成员Excel() {
  try {
    const 结果 = await 导出成员();
    导出工作簿(
      ["用户名", "姓名", "部门名称", "生效时间"],
      结果.items.map((item) => [
        item.username,
        item.displayName,
        item.departmentName,
        item.effectiveAt || "",
      ]),
      "组织架构-成员导出.xlsx",
      "成员",
    );
  } catch (error) {
    ElMessage.error(读取错误信息(error, "成员导出失败。"));
  }
}

async function 处理部门导入文件(event: Event) {
  const 目标 = event.target as HTMLInputElement | null;
  if (!目标) return;
  const 输入 = 目标;
  const file = 输入.files?.[0];
  输入.value = "";
  if (!file || !可写.value) return;
  try {
    const 原始行 = await 解析Excel工作簿(file);
    const 行数据 = 原始行
      .map((row) => ({
        name: String(row["部门名称"] ?? "").trim(),
        parentName: String(row["上级部门"] ?? "").trim() || undefined,
        sortOrder: Number(row["排序"] ?? 0) || 0,
        statusCode: ["active", "draft", "disabled"].includes(String(row["状态"] ?? "").trim())
          ? String(row["状态"]).trim()
          : "active",
      }))
      .filter((row) => row.name);
    if (!行数据.length) {
      ElMessage.warning("未识别到有效部门数据，请按「部门名称/上级部门/排序/状态」表头填写。");
      return;
    }
    const 结果 = await 导入部门(行数据);
    ElMessage.success(`部门导入完成，共 ${结果.imported} 条。`);
    await 加载页面();
  } catch (error) {
    ElMessage.error(读取错误信息(error, "部门导入失败。"));
  }
}

async function 处理成员导入文件(event: Event) {
  const 目标 = event.target as HTMLInputElement | null;
  if (!目标) return;
  const 输入 = 目标;
  const file = 输入.files?.[0];
  输入.value = "";
  if (!file || !可写.value) return;
  try {
    const 原始行 = await 解析Excel工作簿(file);
    const 行数据 = 原始行
      .map((row) => ({
        username: String(row["用户名"] ?? "").trim(),
        departmentName: String(row["部门名称"] ?? "").trim(),
      }))
      .filter((row) => row.username && row.departmentName);
    if (!行数据.length) {
      ElMessage.warning("未识别到有效成员数据，请按「用户名/部门名称」表头填写。");
      return;
    }
    const 结果 = await 导入成员(行数据);
    ElMessage.success(`成员导入完成，共 ${结果.imported} 条。`);
    await 加载页面();
  } catch (error) {
    ElMessage.error(读取错误信息(error, "成员导入失败。"));
  }
}

function 打开新建弹窗(类型: 新建类型) {
  当前新建类型.value = 类型;
  新建弹窗打开.value = true;
}

function 重置新建表单() {
  Object.assign(新建表单, {
    unitCode: "",
    unitName: "",
    unitType: "department",
    parentUnitId: "",
    sortOrder: 0,
    orgUnitId: "",
    positionCode: "",
    positionName: "",
    positionCategory: "other",
    roleCode: "",
    roleName: "",
    domainCode: "internal",
    roleCategory: "other",
    templateCode: "",
    templateName: "",
    templateCategory: "other",
    issuerName: "",
    validityMonths: undefined,
  });
}

async function 提交新建() {
  if (!可写.value) return;
  提交中.value = true;
  try {
    const 选项 = { 幂等键: 生成组织幂等键() };
    if (当前新建类型.value === "unit") {
      await 创建组织(
        {
          unitName: 新建表单.unitName,
          ...(新建表单.parentUnitId ? { parentUnitId: 新建表单.parentUnitId } : {}),
          sortOrder: Number(新建表单.sortOrder),
        },
        选项,
      );
    } else if (当前新建类型.value === "businessRole") {
      await 创建业务角色(
        {
          roleCode: 新建表单.roleCode,
          roleName: 新建表单.roleName,
          domainCode: 新建表单.domainCode,
          category: 新建表单.roleCategory,
        },
        选项,
      );
    } else {
      await 创建证书模板(
        {
          templateCode: 新建表单.templateCode,
          templateName: 新建表单.templateName,
          category: 新建表单.templateCategory,
          issuerName: 新建表单.issuerName,
          ...(新建表单.validityMonths ? { validityMonths: Number(新建表单.validityMonths) } : {}),
        },
        选项,
      );
    }
    ElMessage.success("已提交并写入审计记录。");
    新建弹窗打开.value = false;
    重置新建表单();
    await 加载页面();
  } catch (error) {
    ElMessage.error(读取错误信息(error, "提交失败，请检查填写内容后重试。"));
  } finally {
    提交中.value = false;
  }
}

// —— 账号统一维护（组织架构内编辑/新建，不触碰登录与单点登录）——
const 当前部门岗位列表 = computed(() =>
  新任职表单.orgUnitId
    ? 岗位列表.value.filter(
        (p) => p.orgUnitId === 新任职表单.orgUnitId && p.statusCode === "active",
      )
    : [],
);
const 编辑部门岗位列表 = computed(() =>
  新建用户表单.orgUnitId
    ? 岗位列表.value.filter(
        (p) => p.orgUnitId === 新建用户表单.orgUnitId && p.statusCode === "active",
      )
    : [],
);

function 角色中文(角色: string): string {
  return (
    {
      superadmin: "超级管理员",
      admin: "区域管理员",
      region_manager: "区域管理员",
      partner_admin: "企业管理员",
      staff: "员工",
    }[角色] ||
    角色 ||
    "—"
  );
}
function 状态中文(状态: string | null | undefined, 空文本 = "—"): string {
  const 映射: Record<string, string> = {
    active: "启用",
    disabled: "停用",
    pending: "待审批",
    approved: "已审批",
    rejected: "已驳回",
    processing: "处理中",
    completed: "已完成",
    closed: "已关闭",
    expired: "已过期",
    revoked: "已撤销",
    locked: "已锁定",
    draft: "草稿",
    syncing: "同步中",
    success: "成功",
    failed: "失败",
    applied: "已应用",
    skipped: "已跳过",
    running: "运行中",
    inactive: "停用",
  };
  return 状态 === null || 状态 === undefined || String(状态).trim() === ""
    ? 空文本
    : 映射[状态] || 状态;
}
function 领域中文(域: string | undefined): string {
  if (域 === "internal") return "内部";
  if (域 === "channel") return "渠道";
  return 域 || "—";
}
function 业务角色类别中文(类别: string): string {
  return (
    {
      sales: "销售",
      pre_sales: "售前",
      post_sales: "售后",
      tech_engineer: "技术工程师",
      business_assistant: "业务助理",
      manager: "管理",
      other: "其他",
    }[类别] ||
    类别 ||
    "—"
  );
}
function 证书类别中文(类别: string): string {
  return 类别 || "—";
}
function 同步运行类型中文(类型: string): string {
  return { full: "全量", incremental: "增量" }[类型] || 类型 || "—";
}
function 同步对象中文(对象: string): string {
  return { user: "用户", department: "部门", partner: "渠道商" }[对象] || 对象 || "—";
}
function 同步变更类型中文(类型: string): string {
  return (
    {
      create: "新增",
      update: "更新",
      disable: "停用",
      delete: "删除",
      move: "移动",
      rename: "改名",
    }[类型] ||
    类型 ||
    "—"
  );
}
function 风险级别中文(级别: string): string {
  return { low: "低", medium: "中", high: "高" }[级别] || 级别 || "—";
}
function 审批状态中文(状态: string): string {
  return { pending: "待审批", approved: "已审批", rejected: "已驳回" }[状态] || 状态 || "—";
}
function 应用状态中文(状态: string): string {
  return (
    { pending: "待应用", applied: "已应用", skipped: "已跳过", failed: "失败" }[状态] || 状态 || "—"
  );
}
function 格式化时间(值: string | null | undefined, 空文本 = "—"): string {
  if (值 === null || 值 === undefined || String(值).trim() === "") return 空文本;
  const 文本 = String(值).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(文本)) return 文本;
  const 日期 = new Date(文本);
  if (Number.isNaN(日期.getTime()))
    return 文本
      .replace("T", " ")
      .replace(/(\.\d+)?Z$/, "")
      .slice(0, 16);
  const 部分 = Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(日期)
      .filter((部分) => 部分.type !== "literal")
      .map((部分) => [部分.type, 部分.value]),
  );
  return `${部分.year}-${部分.month}-${部分.day} ${部分.hour}:${部分.minute}`;
}

function 解析账号行(行: 接口对象): 账号台账行 {
  const 原始 = (行.原始数据 || {}) as 接口对象;
  return {
    id: String(行.id || ""),
    username: String(行.负责人 || 原始.username || ""),
    name: String(行.标题 || 原始.name || ""),
    role: String(原始.role || "staff"),
    status: String(行.状态 || 原始.status || "active"),
    phone: String(原始.phone || ""),
    email: String(原始.email || ""),
    bigRegion: String(原始.bigRegion || ""),
    region: String(行.区域 || 原始.region || ""),
    remark: String(原始.remark || ""),
    createdAt: String(行.创建时间 || ""),
  };
}
async function 加载账号列表(): Promise<void> {
  try {
    const 结果 = await 读取用户列表();
    账号列表.value = (结果.数据 || []).map(解析账号行);
  } catch {
    账号列表.value = [];
  }
}
function 检索账号(): void {
  const 词 = String(账号检索词.value || "")
    .trim()
    .toLowerCase();
  账号检索结果.value = [];
  if (!词) return;
  账号检索中.value = true;
  const 命中 = 账号列表.value.filter(
    (账号) =>
      账号.role !== "partner_admin" &&
      (账号.username.toLowerCase().includes(词) || 账号.name.toLowerCase().includes(词)),
  );
  账号检索结果.value = 命中.slice(0, 8);
  账号检索中.value = false;
}
async function 打开账号编辑(账号: 账号台账行 | null): Promise<void> {
  const 目标 = 账号?.id
    ? 账号
    : 账号列表.value.find((a) => a.username === String(账号?.username || ""));
  if (!目标) return;
  编辑用户.value = { ...目标, avatar: (目标.name || "?").slice(0, 1) };
  基本信息表单.name = 目标.name || "";
  基本信息表单.phone = 目标.phone || "";
  基本信息表单.email = 目标.email || "";
  基本信息表单.status = 目标.status === "disabled" ? "disabled" : "active";
  await 加载编辑详情(目标.id);
  编辑抽屉打开.value = true;
}
async function 打开成员编辑(成员: 成员概要): Promise<void> {
  await 打开账号编辑({
    id: 成员.userId,
    username: 成员.username,
    name: 成员.displayName,
    role: "staff",
    status: "active",
  });
}
async function 打开任职编辑(任职: 任职): Promise<void> {
  await 打开账号编辑({
    id: String(任职.userId || ""),
    username: "",
    name: String(任职.displayName || ""),
    role: "staff",
    status: "active",
  });
}
async function 加载编辑详情(userId: string): Promise<void> {
  编辑用户任职.value = 任职列表.value.filter((项) => 项.userId === userId && !项.expiredAt);
  编辑用户证书.value = 证书按用户.value.get(userId) || [];
  编辑用户业务角色.value = 成员业务角色列表.value.filter(
    (项) => 项.userId === userId && 项.staffAssignmentId && !项.expiredAt,
  );
  try {
    泛微OA身份.value = await 读取泛微OA身份(userId);
    填充泛微候选表单(待核验泛微候选.value);
  } catch (error) {
    泛微OA身份.value = null;
    重置泛微候选表单();
    ElMessage.warning("泛微 OA 身份读取失败：" + 读取错误信息(error, "未知错误"));
  }
}

const 待核验泛微候选 = computed<泛微OA身份候选 | null>(
  () => 泛微OA身份.value?.candidates.find((候选) => 候选.statusCode === "pending") || null,
);

function 填充泛微候选表单(候选: 泛微OA身份候选 | null): void {
  泛微候选表单.externalSubject = 候选?.externalSubject || "";
  泛微候选表单.externalUsername = 候选?.externalUsername || "";
  泛微候选表单.sourceCode = 候选?.sourceCode || "manual";
}

function 重置泛微候选表单(): void {
  填充泛微候选表单(null);
}

function 泛微候选来源中文(来源: string): string {
  return 来源 === "eteams_directory" ? "泛微用户目录" : "人工录入";
}

function 泛微候选状态中文(状态: string): string {
  return (
    { pending: "待核验", confirmed: "已确认", rejected: "已驳回", superseded: "已替代" }[状态] ||
    状态 ||
    "—"
  );
}

async function 保存泛微候选(): Promise<void> {
  if (!编辑用户.value || !可写.value) return;
  if (!泛微候选表单.externalSubject.trim() || !泛微候选表单.externalUsername.trim()) {
    ElMessage.warning("请填写泛微 OA userid 和对方姓名或登录名。");
    return;
  }
  提交中.value = true;
  try {
    const 内容 = {
      externalSubject: 泛微候选表单.externalSubject.trim(),
      externalUsername: 泛微候选表单.externalUsername.trim(),
      sourceCode: 泛微候选表单.sourceCode,
    };
    if (待核验泛微候选.value) {
      await 更新泛微OA身份候选(编辑用户.value.id, 待核验泛微候选.value.id, 内容, {
        rowVersion: 待核验泛微候选.value.rowVersion,
        幂等键: 生成组织幂等键(),
      });
      ElMessage.success("泛微 OA 身份候选已更新，仍需人工确认。");
    } else {
      await 创建泛微OA身份候选(编辑用户.value.id, 内容, { 幂等键: 生成组织幂等键() });
      ElMessage.success("泛微 OA 身份候选已保存，尚不能用于发起流程。");
    }
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("保存候选失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}

async function 确认当前泛微候选(): Promise<void> {
  if (!编辑用户.value || !待核验泛微候选.value || !可写.value) return;
  const 核验说明 = window.prompt("请填写核验依据（可留空）；确认后该身份将可用于 OA 发起：", "");
  if (核验说明 === null) return;
  if (!window.confirm("确认该泛微 OA userid 已属于当前账号？确认后将创建正式映射。")) return;
  提交中.value = true;
  try {
    await 确认泛微OA身份候选(
      编辑用户.value.id,
      待核验泛微候选.value.id,
      核验说明.trim() ? { verificationNote: 核验说明.trim() } : {},
      { rowVersion: 待核验泛微候选.value.rowVersion, 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("泛微 OA 身份已确认，可供后续订单预审流程使用。");
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("确认失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}

async function 驳回当前泛微候选(): Promise<void> {
  if (!编辑用户.value || !待核验泛微候选.value || !可写.value) return;
  const 原因 = window.prompt("请填写驳回原因：", "");
  if (原因 === null) return;
  if (!原因.trim()) {
    ElMessage.warning("请填写驳回原因。");
    return;
  }
  提交中.value = true;
  try {
    await 驳回泛微OA身份候选(
      编辑用户.value.id,
      待核验泛微候选.value.id,
      { rejectedReason: 原因.trim() },
      { rowVersion: 待核验泛微候选.value.rowVersion, 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("泛微 OA 身份候选已驳回。");
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("驳回失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}

async function 停用当前泛微正式身份(): Promise<void> {
  if (!编辑用户.value || !泛微OA身份.value?.formalIdentity || !可写.value) return;
  const 原因 = window.prompt("请填写停用原因：", "");
  if (原因 === null) return;
  if (!原因.trim()) {
    ElMessage.warning("请填写停用原因。");
    return;
  }
  if (!window.confirm("停用后该账号不能再作为 OA 流程发起人，确认继续？")) return;
  提交中.value = true;
  try {
    await 停用泛微OA身份(
      编辑用户.value.id,
      { identityId: 泛微OA身份.value.formalIdentity.id, reason: 原因.trim() },
      { rowVersion: 泛微OA身份.value.formalIdentity.rowVersion, 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("泛微 OA 正式身份已停用，历史记录仍保留。");
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("停用失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}
function 任职部门名(任职: 任职): string {
  const 节点 = 查找树节点(树数据.value, String(任职.orgUnitId || ""));
  return 节点 ? 节点.label : "—";
}
function 编辑用户主职任职(): 任职 | null {
  return 编辑用户任职.value.find((项) => 项.isPrimary) || 编辑用户任职.value[0] || null;
}
async function 保存基本信息(): Promise<void> {
  if (!编辑用户.value || !可写.value) return;
  提交中.value = true;
  try {
    await 更新用户(编辑用户.value.id, {
      name: 基本信息表单.name,
      phone: 基本信息表单.phone,
      email: 基本信息表单.email,
    });
    ElMessage.success("基本信息已保存。");
    编辑用户.value.name = 基本信息表单.name;
    编辑用户.value.phone = 基本信息表单.phone;
    编辑用户.value.email = 基本信息表单.email;
    await 加载账号列表();
    await 加载页面();
  } catch (error) {
    ElMessage.error("保存失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}
async function 重置密码(): Promise<void> {
  if (!编辑用户.value || !可写.value) return;
  if (!window.confirm(`确认将「${编辑用户.value.name}」的密码重置为 123456 吗？`)) return;
  try {
    await 重置用户密码(编辑用户.value.id, "123456");
    ElMessage.success("密码已重置为 123456。");
  } catch (error) {
    ElMessage.error("重置失败：" + 读取错误信息(error, "未知错误"));
  }
}
async function 新增任职(): Promise<void> {
  if (!编辑用户.value || !可写.value) return;
  if (!新任职表单.orgUnitId) {
    ElMessage.warning("请选择部门。");
    return;
  }
  提交中.value = true;
  try {
    await 创建任职(
      编辑用户.value.id,
      {
        orgUnitId: 新任职表单.orgUnitId,
        ...(新任职表单.positionId ? { positionId: 新任职表单.positionId } : {}),
        isPrimary: !!新任职表单.isPrimary,
      },
      { 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("任职已添加。");
    新任职表单.orgUnitId = "";
    新任职表单.positionId = "";
    新任职表单.isPrimary = false;
    await 加载页面();
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("添加失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}
async function 结束任职(任职: 任职): Promise<void> {
  if (!可写.value) return;
  if (!window.confirm("确认结束该任职吗？")) return;
  try {
    await 结束任职API(任职.id, { rowVersion: 任职.rowVersion }, { 幂等键: 生成组织幂等键() });
    ElMessage.success("任职已结束。");
    await 加载页面();
    await 加载编辑详情(编辑用户.value?.id || "");
  } catch (error) {
    ElMessage.error("操作失败：" + 读取错误信息(error, "未知错误"));
  }
}
async function 指派业务角色(): Promise<void> {
  if (!编辑用户.value || !可写.value) return;
  if (!新业务角色表单.businessRoleId) {
    ElMessage.warning("请选择业务角色。");
    return;
  }
  const 主职 = 编辑用户主职任职();
  if (!主职) {
    ElMessage.warning("请先为账号添加任职，再指派业务角色。");
    return;
  }
  提交中.value = true;
  try {
    await 指派成员业务角色(
      {
        businessRoleId: 新业务角色表单.businessRoleId,
        staffAssignmentId: 主职.id,
        isPrimaryDisplay: true,
      },
      { 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("业务角色已指派。");
    新业务角色表单.businessRoleId = "";
    await 加载页面();
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("指派失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}
async function 结束业务角色(角色: 成员业务角色): Promise<void> {
  if (!可写.value) return;
  if (!window.confirm("确认结束该业务角色吗？")) return;
  try {
    await 结束成员业务角色(角色.id, { rowVersion: 角色.rowVersion }, { 幂等键: 生成组织幂等键() });
    ElMessage.success("业务角色已结束。");
    await 加载页面();
    await 加载编辑详情(编辑用户.value?.id || "");
  } catch (error) {
    ElMessage.error("操作失败：" + 读取错误信息(error, "未知错误"));
  }
}
async function 颁发证书(): Promise<void> {
  if (!编辑用户.value || !可写.value) return;
  if (!新证书表单.certificationTemplateId) {
    ElMessage.warning("请选择证书模板。");
    return;
  }
  提交中.value = true;
  try {
    await 颁发证书API(
      编辑用户.value.id,
      {
        certificationTemplateId: 新证书表单.certificationTemplateId,
        certificateNo: 新证书表单.certificateNo || "",
        issuedOn: new Date().toISOString().slice(0, 10),
        ...(新证书表单.expiresOn ? { expiresOn: 新证书表单.expiresOn } : {}),
      },
      { 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("证书已颁发。");
    新证书表单.certificationTemplateId = "";
    新证书表单.certificateNo = "";
    新证书表单.expiresOn = "";
    await 加载页面();
    await 加载编辑详情(编辑用户.value.id);
  } catch (error) {
    ElMessage.error("颁发失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}
async function 撤销证书(证: 成员证书): Promise<void> {
  if (!可写.value) return;
  if (!window.confirm(`确认撤销证书「${证.templateName}」吗？`)) return;
  try {
    await 撤销证书API(
      证.id,
      { reason: "管理员撤销", rowVersion: 证.rowVersion },
      { 幂等键: 生成组织幂等键() },
    );
    ElMessage.success("证书已撤销。");
    await 加载页面();
    await 加载编辑详情(编辑用户.value?.id || "");
  } catch (error) {
    ElMessage.error("操作失败：" + 读取错误信息(error, "未知错误"));
  }
}
function 关闭编辑抽屉(): void {
  编辑抽屉打开.value = false;
  编辑用户.value = null;
  编辑用户任职.value = [];
  编辑用户业务角色.value = [];
  编辑用户证书.value = [];
  泛微OA身份.value = null;
  重置泛微候选表单();
  新任职表单.orgUnitId = "";
  新任职表单.positionId = "";
  新任职表单.isPrimary = false;
  新业务角色表单.businessRoleId = "";
  新证书表单.certificationTemplateId = "";
  新证书表单.certificateNo = "";
  新证书表单.expiresOn = "";
}
function 打开新建用户弹窗(): void {
  新建用户表单.username = "";
  新建用户表单.name = "";
  新建用户表单.phone = "";
  新建用户表单.email = "";
  新建用户表单.password = "123456";
  新建用户表单.status = "active";
  新建用户表单.role = "staff";
  新建用户表单.bigRegion = "";
  新建用户表单.region = "";
  新建用户表单.orgUnitId =
    选中部门Id.value || (平铺组织列表.value[0] ? 平铺组织列表.value[0].id : "");
  新建用户表单.isPrimary = true;
  新建用户表单.positionId = "";
  新建用户表单.businessRoleIds = [];
  新建用户表单.certificationTemplateId = "";
  新建用户表单.certificateExpiresOn = "";
  新建用户弹窗打开.value = true;
}
async function 提交新建用户(): Promise<void> {
  if (!可写.value) return;
  if (!新建用户表单.username || !新建用户表单.name) {
    ElMessage.warning("请填写登录账号和姓名。");
    return;
  }
  if (!新建用户表单.orgUnitId) {
    ElMessage.warning("请选择所属部门。");
    return;
  }
  提交中.value = true;
  try {
    const 账号载荷: 接口对象 = {
      username: 新建用户表单.username,
      name: 新建用户表单.name,
      role: 新建用户表单.role,
      status: 新建用户表单.status,
      phone: 新建用户表单.phone,
      email: 新建用户表单.email,
      password: 新建用户表单.password || "123456",
      ...(["admin", "region_manager"].includes(新建用户表单.role)
        ? { bigRegion: 新建用户表单.bigRegion, region: 新建用户表单.region }
        : {}),
    };
    await 创建用户(账号载荷);
    await 加载账号列表();
    const 新账号 = 账号列表.value.find(
      (账号) => 账号.username === String(新建用户表单.username).trim(),
    );
    if (!新账号) {
      ElMessage.warning("账号已创建，但未能定位到用户ID，请稍后在账号检索中打开后完善组织信息。");
      新建用户弹窗打开.value = false;
      await 加载页面();
      return;
    }
    const 用户Id = 新账号.id;
    await 创建任职(
      用户Id,
      {
        orgUnitId: 新建用户表单.orgUnitId,
        ...(新建用户表单.positionId ? { positionId: 新建用户表单.positionId } : {}),
        isPrimary: !!新建用户表单.isPrimary,
      },
      { 幂等键: 生成组织幂等键() },
    );
    const 任职结果 = await 查询任职(新建用户表单.orgUnitId);
    const 新任职 = (任职结果.items || []).find((项) => 项.userId === 用户Id && !项.expiredAt);
    for (const 角色Id of 新建用户表单.businessRoleIds || []) {
      if (新任职) {
        await 指派成员业务角色(
          {
            businessRoleId: 角色Id,
            staffAssignmentId: 新任职.id,
            isPrimaryDisplay: true,
          },
          { 幂等键: 生成组织幂等键() },
        );
      }
    }
    if (新建用户表单.certificationTemplateId) {
      await 颁发证书API(
        用户Id,
        {
          certificationTemplateId: 新建用户表单.certificationTemplateId,
          certificateNo: "",
          issuedOn: new Date().toISOString().slice(0, 10),
          ...(新建用户表单.certificateExpiresOn
            ? { expiresOn: 新建用户表单.certificateExpiresOn }
            : {}),
        },
        { 幂等键: 生成组织幂等键() },
      );
    }
    ElMessage.success("用户已创建，并完成任职与授权。");
    新建用户弹窗打开.value = false;
    await 加载页面();
  } catch (error) {
    ElMessage.error("创建失败：" + 读取错误信息(error, "未知错误"));
  } finally {
    提交中.value = false;
  }
}

watch(新建弹窗打开, (打开) => {
  if (!打开) 重置新建表单();
});

watch(组织树, (树) => {
  if (!选中部门Id.value && 树.length && 树[0]) 选中部门Id.value = 树[0].id;
});

watch(部门搜索词, (词) => {
  部门树引用.value?.filter(词);
});

watch(渠道组织树, (树) => {
  if (!选中渠道Id.value && 树.length && 树[0]) 选中渠道Id.value = String(树[0].id);
});

watch(渠道搜索词, (词) => {
  渠道树引用.value?.filter(词);
});

onMounted(() => {
  按访问终端加载页面();
  window.addEventListener("resize", 按访问终端加载页面);
});

onBeforeUnmount(() => window.removeEventListener("resize", 按访问终端加载页面));
</script>

<template>
  <main class="组织工作区">
    <header class="组织顶栏">
      <div>
        <p class="组织面包屑">平台管理 / 组织架构</p>
        <h1>{{ 当前导航.名称 }}</h1>
      </div>
      <div class="组织顶栏动作">
        <el-tag :type="可写 ? 'success' : 'info'" effect="plain">
          {{ 可写 ? "写入已受控开启" : "只读观察模式" }}
        </el-tag>
        <el-tag
          :type="组织功能状态?.accountStatusCheckEnabled ? 'success' : 'warning'"
          effect="plain"
        >
          {{
            组织功能状态?.accountStatusCheckEnabled ? "账号停权防护已开启" : "账号停权防护未开启"
          }}
        </el-tag>
        <a class="返回工作台" href="/admin.html">返回管理工作台</a>
      </div>
    </header>

    <el-alert
      v-if="移动访问"
      title="组织架构首期仅支持桌面端管理"
      type="warning"
      :closable="false"
      show-icon
      description="当前页面不会在管理端、渠道端或移动端正式业务页中展示。请使用桌面端继续，既有业务不受影响。"
    />

    <template v-else>
      <nav class="组织导航" aria-label="组织架构导航">
        <RouterLink
          v-for="item in 导航项列表"
          :key="item.栏目"
          :to="item.路径"
          :class="{ '组织导航-激活': 当前栏目 === item.栏目 }"
        >
          {{ item.名称 }}
        </RouterLink>
      </nav>

      <el-alert
        v-if="!加载中 && !已启用"
        title="组织架构功能尚未启用"
        type="info"
        :closable="false"
        show-icon
        description="当前环境保持默认关闭，不读取或修改组织数据；请完成灰度审批和主业务回归后，再由运维受控启用。"
      />
      <el-alert
        v-else-if="!加载中 && !可写"
        title="当前为只读观察模式"
        type="warning"
        :closable="false"
        show-icon
        description="可以核对组织、岗位、任职、角色、证书、离职交接和企微预览状态；所有写入按钮均保持关闭。"
      />
      <el-alert v-if="错误提示" :title="错误提示" type="error" :closable="false" show-icon />

      <section v-if="加载中" class="组织加载中">
        <el-skeleton :rows="8" animated />
      </section>

      <template v-else-if="已启用 && !错误提示">
        <section v-if="当前栏目 === 'units'" class="组织双栏">
          <article class="组织卡片" style="grid-column: 1 / -1">
            <div class="组织卡片标题">
              <div>
                <h2>组织架构</h2>
                <p>左侧选择部门，右侧查看该部门成员的概要信息与证书。</p>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
                <el-input
                  v-model="账号检索词"
                  placeholder="检索任意内部账号（用户名/姓名）"
                  clearable
                  size="small"
                  style="width: 240px"
                  @keyup.enter="检索账号"
                  @change="检索账号"
                />
                <el-button v-if="可写" @click="触发文件选择('部门')">导入部门</el-button>
                <el-button @click="导出部门Excel">导出部门</el-button>
                <el-button v-if="可写" type="primary" @click="打开新建弹窗('unit')"
                  >新建组织</el-button
                >
                <el-button v-if="可写" type="primary" plain @click="打开新建用户弹窗"
                  >新建用户</el-button
                >
              </div>
              <div v-if="账号检索结果.length" class="组织账号检索结果">
                <span
                  v-for="账号 in 账号检索结果"
                  :key="账号.id"
                  class="组织账号检索项"
                  @click="打开账号编辑(账号)"
                  >{{ 账号.name }}（{{ 账号.username }}）· {{ 角色中文(账号.role) }}</span
                >
                <span v-if="账号检索中" class="组织账号检索提示">检索中...</span>
              </div>
            </div>
            <input
              ref="部门文件输入"
              type="file"
              accept=".xlsx,.xls"
              style="display: none"
              @change="处理部门导入文件"
            />
            <div class="组织左右布局">
              <aside class="组织部门树">
                <el-select
                  v-model="选中部门Id"
                  filterable
                  clearable
                  placeholder="快捷选择部门（含全部层级）"
                  size="small"
                  class="组织搜索框"
                  @change="定位部门"
                >
                  <el-option
                    v-for="节点 in 平铺树数据"
                    :key="节点.id"
                    :label="' '.repeat(节点.层级) + 节点.label"
                    :value="节点.id"
                  />
                </el-select>
                <el-input
                  v-model="部门搜索词"
                  placeholder="搜索部门"
                  clearable
                  size="small"
                  class="组织搜索框"
                />
                <el-tree
                  ref="部门树引用"
                  :data="树数据"
                  node-key="id"
                  :props="树节点属性"
                  :filter-node-method="过滤部门节点"
                  :expand-on-click-node="false"
                  highlight-current
                  default-expand-all
                  @node-click="选择部门"
                >
                  <template #default="{ data }">
                    <span class="组织树节点">
                      <span>{{ data.label }}</span>
                      <el-tag size="small" type="info" class="组织树计数">{{
                        节点成员数(data)
                      }}</el-tag>
                    </span>
                  </template>
                </el-tree>
              </aside>
              <section class="组织成员面板">
                <div class="组织成员面板标题">
                  <h3>{{ 当前部门名称 }}</h3>
                  <el-tag size="small" :type="当前部门成员.length ? 'success' : 'info'"
                    >共 {{ 当前部门成员.length }} 名成员</el-tag
                  >
                  <el-input
                    v-model="成员搜索词"
                    placeholder="搜索成员姓名/用户名"
                    clearable
                    size="small"
                    class="组织搜索框"
                  />
                </div>
                <div v-if="过滤后成员.length" class="组织成员网格">
                  <article v-for="成员 in 过滤后成员" :key="成员.assignmentId" class="组织成员卡片">
                    <div class="组织成员头部">
                      <span class="组织成员头像">{{ 成员.displayName.slice(0, 1) }}</span>
                      <div class="组织成员身份">
                        <div class="组织成员姓名">{{ 成员.displayName }}</div>
                        <div class="组织成员账号">{{ 成员.username }}</div>
                      </div>
                      <el-tag size="small" :type="成员.isPrimary ? 'success' : 'info'">{{
                        成员.isPrimary ? "主职" : "兼职"
                      }}</el-tag>
                      <el-button
                        v-if="可写"
                        size="small"
                        text
                        type="primary"
                        @click.stop="打开成员编辑(成员)"
                        >编辑</el-button
                      >
                    </div>
                    <dl class="组织成员概要">
                      <div>
                        <dt>岗位</dt>
                        <dd>{{ 成员.positionName || "—" }}</dd>
                      </div>
                      <div>
                        <dt>直属负责人</dt>
                        <dd>{{ 成员.直属负责人 || "—" }}</dd>
                      </div>
                      <div>
                        <dt>生效时间</dt>
                        <dd>{{ 格式化时间(成员.effectiveAt) }}</dd>
                      </div>
                      <div>
                        <dt>证书</dt>
                        <dd>{{ 成员.证书.length }} 份</dd>
                      </div>
                    </dl>
                    <div v-if="成员.证书.length" class="组织成员证书">
                      <el-tag
                        v-for="证 in 成员.证书"
                        :key="证.id"
                        size="small"
                        :type="证书状态类型(证)"
                        :title="证书详情(证)"
                        >{{ 证.templateName }}</el-tag
                      >
                    </div>
                    <p v-else class="组织无证书">暂无证书</p>
                  </article>
                </div>
                <el-empty v-else description="该部门暂无成员" />
              </section>
            </div>
          </article>
          <article class="组织卡片" style="grid-column: 1 / -1">
            <div class="组织卡片标题">
              <div>
                <h2>渠道组织树</h2>
                <p>左侧选择渠道商，右侧查看该渠道商的成员；企业管理员会单独标识。</p>
              </div>
              <el-tag type="warning" effect="plain">只读数据，来源于渠道商管理</el-tag>
            </div>
            <div class="组织左右布局">
              <aside class="组织部门树">
                <el-input
                  v-model="渠道搜索词"
                  placeholder="搜索渠道商"
                  clearable
                  size="small"
                  class="组织搜索框"
                />
                <el-tree
                  ref="渠道树引用"
                  :data="渠道树数据"
                  node-key="id"
                  :props="树节点属性"
                  :filter-node-method="过滤渠道节点"
                  :expand-on-click-node="false"
                  highlight-current
                  default-expand-all
                  @node-click="选择渠道"
                >
                  <template #default="{ data }">
                    <span class="组织树节点">
                      <span>{{ data.label }}</span>
                      <el-tag size="small" type="info" class="组织树计数">{{
                        渠道节点成员数(data)
                      }}</el-tag>
                    </span>
                  </template>
                </el-tree>
              </aside>
              <section class="组织成员面板">
                <div class="组织成员面板标题">
                  <h3>{{ 当前渠道名称 }}</h3>
                  <el-tag size="small" :type="当前渠道成员.length ? 'success' : 'info'"
                    >共 {{ 当前渠道成员.length }} 名成员</el-tag
                  >
                  <el-input
                    v-model="渠道成员搜索词"
                    placeholder="搜索成员姓名/用户名"
                    clearable
                    size="small"
                    class="组织搜索框"
                  />
                </div>
                <div v-if="过滤后渠道成员.length" class="组织成员网格">
                  <article v-for="成员 in 过滤后渠道成员" :key="成员.id" class="组织成员卡片">
                    <div class="组织成员头部">
                      <span class="组织成员头像" :class="{ '组织成员头像-管理员': 成员.isAdmin }">{{
                        成员.displayName.slice(0, 1)
                      }}</span>
                      <div class="组织成员身份">
                        <div class="组织成员姓名">{{ 成员.displayName }}</div>
                        <div class="组织成员账号">{{ 成员.username }}</div>
                      </div>
                      <el-tag v-if="成员.isAdmin" size="small" type="danger" effect="dark"
                        >企业管理员</el-tag
                      >
                      <el-tag v-else size="small" type="info">成员</el-tag>
                    </div>
                    <dl class="组织成员概要">
                      <div>
                        <dt>用户名</dt>
                        <dd>{{ 成员.username }}</dd>
                      </div>
                      <div>
                        <dt>角色</dt>
                        <dd>{{ 成员.isAdmin ? "企业管理员" : "普通成员" }}</dd>
                      </div>
                    </dl>
                  </article>
                </div>
                <el-empty v-else description="该渠道商暂无成员" />
              </section>
            </div>
          </article>
        </section>

        <article v-else-if="当前栏目 === 'staff'" class="组织卡片">
          <div class="组织卡片标题">
            <div>
              <h2>人员与任职</h2>
              <p>任职可有主职和兼职；负责人关系由服务端状态机和行版本校验。</p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap">
              <el-button v-if="可写" @click="触发文件选择('成员')">导入成员</el-button>
              <el-button @click="导出成员Excel">导出成员</el-button>
            </div>
          </div>
          <input
            ref="成员文件输入"
            type="file"
            accept=".xlsx,.xls"
            style="display: none"
            @change="处理成员导入文件"
          />
          <el-table :data="任职列表" empty-text="暂无任职数据">
            <el-table-column prop="displayName" label="人员" min-width="140" />
            <el-table-column prop="positionName" label="岗位" min-width="140" />
            <el-table-column label="主职" width="100"
              ><template #default="{ row }"
                ><el-tag :type="row.isPrimary ? 'success' : 'info'" size="small">{{
                  row.isPrimary ? "主职" : "兼职"
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="直属负责人" min-width="140"
              ><template #default="{ row }">{{
                直属负责人映射.get(row.id) || "—"
              }}</template></el-table-column
            >
            <el-table-column label="生效时间" min-width="170"
              ><template #default="{ row }">{{
                格式化时间(row.effectiveAt)
              }}</template></el-table-column
            >
            <el-table-column label="失效时间" min-width="170"
              ><template #default="{ row }">{{
                格式化时间(row.expiredAt)
              }}</template></el-table-column
            >
            <el-table-column label="操作" width="110" fixed="right"
              ><template #default="{ row }"
                ><el-button v-if="可写" size="small" text type="primary" @click="打开任职编辑(row)"
                  >编辑</el-button
                ></template
              ></el-table-column
            >
          </el-table>
          <p class="组织说明">
            负责人关系已由接口返回。本期页面只读展示关系，后续编辑界面必须携带 rowVersion
            与幂等键，且不能绕过服务端校验。
          </p>
        </article>

        <article v-else-if="当前栏目 === 'business-roles'" class="组织卡片">
          <el-alert
            title="业务角色不等于权限角色"
            type="warning"
            :closable="false"
            show-icon
            description="业务角色用于业务显示和资格约束；实际权限由权限角色与服务端数据范围共同决定。"
          />
          <div class="组织卡片标题">
            <div>
              <h2>业务角色字典</h2>
              <p>内部与渠道角色分别管理，避免跨工作身份串权。</p>
            </div>
            <el-button v-if="可写" type="primary" @click="打开新建弹窗('businessRole')"
              >新建业务角色</el-button
            >
          </div>
          <el-table :data="业务角色列表" empty-text="暂无业务角色数据">
            <el-table-column prop="roleName" label="角色名称" min-width="160" />
            <el-table-column label="领域" min-width="100"
              ><template #default="{ row }">{{
                领域中文(row.domainCode)
              }}</template></el-table-column
            >
            <el-table-column label="类别" min-width="140"
              ><template #default="{ row }">{{
                业务角色类别中文(row.category)
              }}</template></el-table-column
            >
            <el-table-column label="当前持有人" min-width="120"
              ><template #default="{ row }">{{
                业务角色持有人数量.get(row.id) || 0
              }}</template></el-table-column
            >
            <el-table-column label="状态" width="110"
              ><template #default="{ row }">{{
                状态中文(row.statusCode)
              }}</template></el-table-column
            >
          </el-table>
        </article>

        <article v-else-if="当前栏目 === 'certifications'" class="组织卡片">
          <el-alert
            title="证书到期仅告警，不自动撤销业务角色"
            type="info"
            :closable="false"
            show-icon
            description="管理员需要结合实际业务情况，手工处理业务角色和权限差异。"
          />
          <div class="证书统计">
            <span
              >7天内到期：<b>{{ 近期到期数 }}</b> 条</span
            ><span
              >已过期：<b>{{ 已过期数 }}</b> 条</span
            ><span
              >有效记录：<b>{{ 成员证书列表.length - 已过期数 }}</b> 条</span
            >
          </div>
          <div class="组织卡片标题">
            <div>
              <h2>证书模板</h2>
              <p>支持不同类别的证书模板；模板与人员持证记录分别管理。</p>
            </div>
            <el-button v-if="可写" type="primary" @click="打开新建弹窗('certificationTemplate')"
              >新建证书模板</el-button
            >
          </div>
          <el-table :data="证书模板列表" empty-text="暂无证书模板数据">
            <el-table-column prop="templateName" label="模板名称" min-width="180" />
            <el-table-column label="类别" min-width="140"
              ><template #default="{ row }">{{
                证书类别中文(row.category)
              }}</template></el-table-column
            >
            <el-table-column label="状态" width="110"
              ><template #default="{ row }">{{
                状态中文(row.statusCode)
              }}</template></el-table-column
            >
          </el-table>
          <h3>员工证书</h3>
          <el-table :data="成员证书列表" empty-text="暂无员工证书数据">
            <el-table-column prop="displayName" label="持有人" min-width="140" />
            <el-table-column prop="templateName" label="证书模板" min-width="180" />
            <el-table-column label="颁发日" min-width="120"
              ><template #default="{ row }">{{
                格式化时间(row.issuedOn)
              }}</template></el-table-column
            >
            <el-table-column label="到期日" min-width="120"
              ><template #default="{ row }">{{
                格式化时间(row.expiresOn, "长期有效")
              }}</template></el-table-column
            >
            <el-table-column label="状态" width="110"
              ><template #default="{ row }">{{
                状态中文(row.statusCode)
              }}</template></el-table-column
            >
          </el-table>
        </article>

        <article v-else-if="当前栏目 === 'access'" class="组织卡片">
          <el-alert
            title="首期仅支持角色级数据范围"
            type="warning"
            :closable="false"
            show-icon
            description="用户级覆盖默认关闭；业务角色、权限角色和数据范围不能相互替代。"
          />
          <h2>权限角色与数据范围</h2>
          <p class="组织说明">
            服务端的角色级数据范围和权限差异任务接口尚在收口，本页面不提供本地推断、写入或越权编辑，避免影响现有客户、商机、报价和订单范围。
          </p>
        </article>

        <article v-else-if="当前栏目 === 'offboarding'" class="组织卡片">
          <el-alert
            v-if="!组织功能状态?.accountStatusCheckEnabled"
            title="账号停权防护尚未启用"
            type="error"
            :closable="false"
            show-icon
            description="当前只能预览影响；启用停用归档前必须先开启账号状态防护，回退交接执行时也必须保持该防护开启。"
          />
          <el-alert
            title="停用归档由服务端立即停权并异步交接"
            type="warning"
            :closable="false"
            show-icon
            description="账号、历史申请人和审批事实保留；业务负责人分批转移，待办按接收人的有效角色与区域动态可见。"
          />
          <div class="组织卡片标题">
            <div>
              <h2>离职交接单</h2>
              <p>展示已创建交接单及其状态，不删除历史记录。</p>
            </div>
          </div>
          <el-table :data="离职交接列表" empty-text="暂无离职交接单">
            <el-table-column prop="displayName" label="人员" min-width="160" />
            <el-table-column label="状态" min-width="140"
              ><template #default="{ row }">{{
                状态中文(row.statusCode)
              }}</template></el-table-column
            >
            <el-table-column label="生效时间" min-width="180"
              ><template #default="{ row }">{{
                格式化时间(row.effectiveAt)
              }}</template></el-table-column
            >
          </el-table>
        </article>

        <article v-else class="组织卡片">
          <el-alert
            title="企微组织同步仅支持只读预览"
            type="warning"
            :closable="false"
            show-icon
            description="不会自动创建账号、停用账号、离职、授予权限、发放证书、修改渠道归属或改写 CRM 负责人。"
          />
          <div v-if="!组织功能状态?.directorySyncEnabled" class="组织空状态">
            企微同步开关尚未启用，当前没有发起连接、预览或应用的入口。
          </div>
          <template v-else>
            <p v-if="同步错误提示" class="组织错误">{{ 同步错误提示 }}</p>
            <div class="同步状态">
              <span
                >模式：<b>{{ 企微同步状态?.mode || "readonly_preview" }}</b></span
              ><span>应用能力：<b>关闭</b></span
              ><span
                >差异数：<b>{{ 同步差异列表.length }}</b></span
              >
            </div>
            <h2>最近同步批次</h2>
            <el-table :data="同步批次列表" empty-text="暂无同步批次">
              <el-table-column label="状态" min-width="120"
                ><template #default="{ row }">{{
                  状态中文(row.statusCode)
                }}</template></el-table-column
              >
              <el-table-column label="类型" min-width="120"
                ><template #default="{ row }">{{
                  同步运行类型中文(row.runType)
                }}</template></el-table-column
              >
              <el-table-column label="创建时间" min-width="180"
                ><template #default="{ row }">{{
                  格式化时间(row.createdAt)
                }}</template></el-table-column
              >
              <el-table-column label="完成时间" min-width="180"
                ><template #default="{ row }">{{
                  格式化时间(row.completedAt, "处理中")
                }}</template></el-table-column
              >
            </el-table>
            <h3>待核对差异</h3>
            <el-table :data="同步差异列表" empty-text="暂无同步差异">
              <el-table-column label="对象" min-width="120"
                ><template #default="{ row }">{{
                  同步对象中文(row.objectType)
                }}</template></el-table-column
              >
              <el-table-column label="变更类型" min-width="130"
                ><template #default="{ row }">{{
                  同步变更类型中文(row.changeType)
                }}</template></el-table-column
              >
              <el-table-column label="风险级别" min-width="120"
                ><template #default="{ row }">{{
                  风险级别中文(row.riskLevel)
                }}</template></el-table-column
              >
              <el-table-column label="审批状态" min-width="130"
                ><template #default="{ row }">{{
                  审批状态中文(row.approvalStatus)
                }}</template></el-table-column
              >
              <el-table-column label="应用状态" min-width="130"
                ><template #default="{ row }">{{
                  应用状态中文(row.applyStatus)
                }}</template></el-table-column
              >
            </el-table>
          </template>
        </article>
      </template>
    </template>

    <el-dialog
      v-model="新建弹窗打开"
      :title="
        当前新建类型 === 'unit'
          ? '新建组织'
          : 当前新建类型 === 'businessRole'
            ? '新建业务角色'
            : '新建证书模板'
      "
      width="min(560px, 92vw)"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" @submit.prevent="提交新建">
        <template v-if="当前新建类型 === 'unit'">
          <el-form-item label="部门名称" required
            ><el-input v-model="新建表单.unitName" autocomplete="off"
          /></el-form-item>
          <el-form-item label="上级部门"
            ><el-select v-model="新建表单.parentUnitId" clearable class="组织全宽"
              ><el-option
                v-for="组织 in 平铺组织列表"
                :key="组织.id"
                :label="组织.unitName"
                :value="组织.id" /></el-select
          ></el-form-item>
          <el-form-item label="排序"
            ><el-input-number v-model="新建表单.sortOrder" :min="0"
          /></el-form-item>
        </template>
        <template v-else-if="当前新建类型 === 'businessRole'">
          <el-form-item label="角色编码" required
            ><el-input v-model="新建表单.roleCode" autocomplete="off"
          /></el-form-item>
          <el-form-item label="角色名称" required
            ><el-input v-model="新建表单.roleName" autocomplete="off"
          /></el-form-item>
          <el-form-item label="领域" required
            ><el-select v-model="新建表单.domainCode" class="组织全宽"
              ><el-option label="内部" value="internal" /><el-option
                label="渠道"
                value="channel" /></el-select
          ></el-form-item>
          <el-form-item label="类别" required
            ><el-select v-model="新建表单.roleCategory" class="组织全宽"
              ><el-option
                v-for="类型 in [
                  'sales',
                  'pre_sales',
                  'post_sales',
                  'tech_engineer',
                  'business_assistant',
                  'manager',
                  'other',
                ]"
                :key="类型"
                :label="类型"
                :value="类型" /></el-select
          ></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="模板编码" required
            ><el-input v-model="新建表单.templateCode" autocomplete="off"
          /></el-form-item>
          <el-form-item label="模板名称" required
            ><el-input v-model="新建表单.templateName" autocomplete="off"
          /></el-form-item>
          <el-form-item label="类别"
            ><el-input v-model="新建表单.templateCategory" autocomplete="off"
          /></el-form-item>
          <el-form-item label="颁发方"
            ><el-input v-model="新建表单.issuerName" autocomplete="off"
          /></el-form-item>
          <el-form-item label="默认有效月数"
            ><el-input-number v-model="新建表单.validityMonths" :min="1"
          /></el-form-item>
        </template>
      </el-form>
      <template #footer
        ><el-button @click="新建弹窗打开 = false">取消</el-button
        ><el-button type="primary" :loading="提交中" @click="提交新建"
          >确认提交</el-button
        ></template
      >
    </el-dialog>

    <div v-if="新建用户弹窗打开" class="modal-overlay" @click.self="新建用户弹窗打开 = false">
      <div class="modal" style="max-width: 680px">
        <div class="modal-header">
          <div class="modal-title">新建用户</div>
          <span class="modal-close" @click="新建用户弹窗打开 = false">×</span>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="grid-template-columns: 1fr 1fr">
            <div class="form-item">
              <label class="form-label required">登录账号</label
              ><input
                v-model="新建用户表单.username"
                class="form-control"
                placeholder="如：zhangsan"
              />
            </div>
            <div class="form-item">
              <label class="form-label required">姓名</label
              ><input v-model="新建用户表单.name" class="form-control" placeholder="请输入姓名" />
            </div>
            <div class="form-item">
              <label class="form-label">手机号</label
              ><input
                v-model="新建用户表单.phone"
                class="form-control"
                placeholder="138-0000-0000"
              />
            </div>
            <div class="form-item">
              <label class="form-label">邮箱</label
              ><input
                v-model="新建用户表单.email"
                class="form-control"
                placeholder="name@company.com"
              />
            </div>
            <div class="form-item">
              <label class="form-label">初始密码</label
              ><input
                v-model="新建用户表单.password"
                class="form-control"
                placeholder="默认 123456"
              />
            </div>
            <div class="form-item">
              <label class="form-label">账号状态</label>
              <select v-model="新建用户表单.status" class="form-control">
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">登录角色</label>
              <select v-model="新建用户表单.role" class="form-control">
                <option value="staff">员工</option>
                <option value="admin">区域管理员</option>
                <option value="superadmin">超级管理员</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label required">所属部门</label
              ><select v-model="新建用户表单.orgUnitId" class="form-control">
                <option v-for="组织 in 平铺组织列表" :key="组织.id" :value="组织.id">
                  {{ " ".repeat(组织.层级 || 0) }}{{ 组织.unitName }}
                </option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">岗位（可选）</label
              ><select v-model="新建用户表单.positionId" class="form-control">
                <option value="">不设置</option>
                <option v-for="岗位 in 编辑部门岗位列表" :key="岗位.id" :value="岗位.id">
                  {{ 岗位.positionName }}
                </option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">任职类型</label>
              <select v-model="新建用户表单.isPrimary" class="form-control">
                <option :value="true">主职</option>
                <option :value="false">兼职</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">业务角色（可选，多选）</label>
              <select v-model="新建用户表单.businessRoleIds" class="form-control" multiple>
                <option
                  v-for="角色 in 业务角色列表.filter(
                    (r) => r.domainCode === 'internal' && r.statusCode === 'active',
                  )"
                  :key="角色.id"
                  :value="角色.id"
                >
                  {{ 角色.roleName }}
                </option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">入职证书模板（可选）</label>
              <select v-model="新建用户表单.certificationTemplateId" class="form-control">
                <option value="">不颁发</option>
                <option
                  v-for="模板 in 证书模板列表.filter((t) => t.statusCode === 'active')"
                  :key="模板.id"
                  :value="模板.id"
                >
                  {{ 模板.templateName }}
                </option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">证书到期日（可选）</label
              ><input
                v-model="新建用户表单.certificateExpiresOn"
                class="form-control"
                type="date"
              />
            </div>
            <template v-if="新建用户表单.role === 'admin'">
              <div class="form-item">
                <label class="form-label">所属大区</label
                ><select v-model="新建用户表单.bigRegion" class="form-control">
                  <option value="">请选择</option>
                  <option v-for="组 in 大区列表" :key="组.label" :value="组.label">
                    {{ 组.label }}
                  </option>
                </select>
              </div>
              <div class="form-item">
                <label class="form-label">负责区域</label
                ><select v-model="新建用户表单.region" class="form-control">
                  <option value="">请选择</option>
                  <option
                    v-for="区域 in (
                      大区列表.find((g) => g.label === 新建用户表单.bigRegion) || { regions: [] }
                    ).regions"
                    :key="区域"
                    :value="区域"
                  >
                    {{ 区域 }}
                  </option>
                </select>
              </div>
            </template>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="新建用户弹窗打开 = false">取消</button>
          <button class="btn btn-primary" :disabled="提交中" @click="提交新建用户">
            {{ 提交中 ? "提交中..." : "创建用户" }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="编辑抽屉打开 && 编辑用户" class="组织抽屉遮罩" @click.self="关闭编辑抽屉">
      <aside class="组织抽屉">
        <div class="组织抽屉头部">
          <div>
            <h3>{{ 编辑用户.name }}（{{ 编辑用户.username }}）</h3>
            <p>
              {{ 角色中文(编辑用户.role) }} · {{ 状态中文(编辑用户.status) }} · 创建于
              {{ 格式化时间(编辑用户.createdAt) }}
            </p>
          </div>
          <span class="modal-close" @click="关闭编辑抽屉">×</span>
        </div>
        <div class="组织抽屉主体">
          <section class="组织抽屉区块">
            <h4>基本信息</h4>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr">
              <div class="form-item">
                <label class="form-label">姓名</label
                ><input v-model="基本信息表单.name" class="form-control" />
              </div>
              <div class="form-item">
                <label class="form-label">手机号</label
                ><input v-model="基本信息表单.phone" class="form-control" />
              </div>
              <div class="form-item">
                <label class="form-label">邮箱</label
                ><input v-model="基本信息表单.email" class="form-control" />
              </div>
              <div class="form-item">
                <label class="form-label">账号状态</label>
                <input :value="状态中文(编辑用户.status)" class="form-control" disabled />
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px">
              <el-button size="small" type="primary" :loading="提交中" @click="保存基本信息"
                >保存基本信息</el-button
              >
              <el-button size="small" @click="重置密码">重置密码（123456）</el-button>
              <span class="组织说明文字">停用账号必须通过“停用并交接”流程处理。</span>
            </div>
          </section>
          <section class="组织抽屉区块">
            <h4>泛微 OA 身份</h4>
            <p class="组织说明文字">
              仅已确认的泛微 userid 可作为订单预审的 OA
              发起人；候选身份不会自动绑定，也不能用于流程发起。
            </p>
            <div v-if="泛微OA身份?.formalIdentity" class="组织抽屉小卡">
              <div class="组织抽屉小卡主">
                <b>{{ 泛微OA身份.formalIdentity.externalUsername }}</b>
                <span>userid：{{ 泛微OA身份.formalIdentity.externalSubject }}</span>
                <el-tag size="small" type="success">已确认</el-tag>
              </div>
              <div class="组织抽屉小卡次">
                <span>最近更新：{{ 格式化时间(泛微OA身份.formalIdentity.updatedAt) }}</span>
                <el-button v-if="可写" size="small" text type="danger" @click="停用当前泛微正式身份"
                  >停用映射</el-button
                >
              </div>
            </div>
            <div v-else class="组织抽屉空">未记录已确认的泛微 OA 身份。</div>
            <div v-if="泛微OA身份?.candidates.length" style="margin-top: 10px">
              <div v-for="候选 in 泛微OA身份.candidates" :key="候选.id" class="组织抽屉小卡">
                <div class="组织抽屉小卡主">
                  <b>{{ 候选.externalUsername }}</b>
                  <span>userid：{{ 候选.externalSubject }}</span>
                  <el-tag size="small" :type="候选.statusCode === 'pending' ? 'warning' : 'info'">{{
                    泛微候选状态中文(候选.statusCode)
                  }}</el-tag>
                </div>
                <div class="组织抽屉小卡次">
                  <span>
                    来源：{{ 泛微候选来源中文(候选.sourceCode) }}｜核验：{{
                      候选.verifiedByName || 候选.verifiedByUsername || "未核验"
                    }}
                  </span>
                  <span v-if="候选.rejectedReason">驳回原因：{{ 候选.rejectedReason }}</span>
                </div>
              </div>
            </div>
            <div v-if="!泛微OA身份?.formalIdentity" class="组织抽屉新增行" style="margin-top: 10px">
              <input
                v-model="泛微候选表单.externalSubject"
                class="form-control"
                placeholder="泛微 OA userid"
              />
              <input
                v-model="泛微候选表单.externalUsername"
                class="form-control"
                placeholder="泛微姓名或登录名"
              />
              <el-select v-model="泛微候选表单.sourceCode" size="small" style="width: 150px">
                <el-option label="人工录入" value="manual" />
                <el-option label="泛微用户目录" value="eteams_directory" />
              </el-select>
              <el-button
                v-if="可写"
                size="small"
                type="primary"
                plain
                :loading="提交中"
                @click="保存泛微候选"
                >{{ 待核验泛微候选 ? "更正候选" : "保存候选" }}</el-button
              >
              <el-button
                v-if="可写 && 待核验泛微候选"
                size="small"
                type="success"
                plain
                :loading="提交中"
                @click="确认当前泛微候选"
                >确认正式映射</el-button
              >
              <el-button
                v-if="可写 && 待核验泛微候选"
                size="small"
                type="danger"
                text
                :loading="提交中"
                @click="驳回当前泛微候选"
                >驳回</el-button
              >
            </div>
            <p v-if="!可写" class="组织说明文字">当前为只读观察模式，不能维护候选或确认映射。</p>
          </section>
          <section class="组织抽屉区块">
            <h4>任职信息</h4>
            <div v-if="编辑用户任职.length">
              <div v-for="任职 in 编辑用户任职" :key="任职.id" class="组织抽屉小卡">
                <div class="组织抽屉小卡主">
                  <b>{{ 任职部门名(任职) }}</b>
                  <span>{{ 任职.positionName || "未设置岗位" }}</span>
                  <el-tag size="small" :type="任职.isPrimary ? 'success' : 'info'">{{
                    任职.isPrimary ? "主职" : "兼职"
                  }}</el-tag>
                </div>
                <div class="组织抽屉小卡次">
                  <span>生效：{{ 格式化时间(任职.effectiveAt) }}</span>
                  <el-button v-if="可写" size="small" text type="danger" @click="结束任职(任职)"
                    >结束</el-button
                  >
                </div>
              </div>
            </div>
            <div v-else class="组织抽屉空">暂无任职，请为账号添加任职。</div>
            <div class="组织抽屉新增行">
              <el-select
                v-model="新任职表单.orgUnitId"
                size="small"
                placeholder="选择部门"
                filterable
                style="width: 200px"
                @change="新任职表单.positionId = ''"
              >
                <el-option
                  v-for="组织 in 平铺组织列表"
                  :key="组织.id"
                  :label="' '.repeat(组织.层级 || 0) + 组织.unitName"
                  :value="组织.id"
                />
              </el-select>
              <el-select
                v-model="新任职表单.positionId"
                size="small"
                placeholder="岗位（可选）"
                clearable
                style="width: 160px"
              >
                <el-option
                  v-for="岗位 in 当前部门岗位列表"
                  :key="岗位.id"
                  :label="岗位.positionName"
                  :value="岗位.id"
                />
              </el-select>
              <el-radio-group v-model="新任职表单.isPrimary" size="small">
                <el-radio-button :label="true">主职</el-radio-button>
                <el-radio-button :label="false">兼职</el-radio-button>
              </el-radio-group>
              <el-button size="small" type="primary" plain :loading="提交中" @click="新增任职"
                >添加任职</el-button
              >
            </div>
          </section>
          <section class="组织抽屉区块">
            <h4>业务角色</h4>
            <div v-if="编辑用户业务角色.length">
              <div v-for="角色 in 编辑用户业务角色" :key="角色.id" class="组织抽屉小卡">
                <div class="组织抽屉小卡主">
                  <b>{{ 角色.roleName }}</b>
                  <span>{{ 领域中文(角色.domainCode) }}</span>
                  <el-tag size="small" type="success">有效</el-tag>
                </div>
                <div class="组织抽屉小卡次">
                  <span>生效：{{ 格式化时间(角色.effectiveAt) }}</span>
                  <el-button v-if="可写" size="small" text type="danger" @click="结束业务角色(角色)"
                    >结束</el-button
                  >
                </div>
              </div>
            </div>
            <div v-else class="组织抽屉空">暂无业务角色。</div>
            <div class="组织抽屉新增行">
              <el-select
                v-model="新业务角色表单.businessRoleId"
                size="small"
                placeholder="选择内部业务角色"
                filterable
                style="width: 240px"
              >
                <el-option
                  v-for="角色 in 业务角色列表.filter(
                    (r) => r.domainCode === 'internal' && r.statusCode === 'active',
                  )"
                  :key="角色.id"
                  :label="角色.roleName"
                  :value="角色.id"
                />
              </el-select>
              <el-button size="small" type="primary" plain :loading="提交中" @click="指派业务角色"
                >指派</el-button
              >
            </div>
          </section>
          <section class="组织抽屉区块">
            <h4>证书</h4>
            <div v-if="编辑用户证书.length">
              <div v-for="证 in 编辑用户证书" :key="证.id" class="组织抽屉小卡">
                <div class="组织抽屉小卡主">
                  <b>{{ 证.templateName }}</b>
                  <el-tag size="small" :type="证书状态类型(证)">{{
                    状态中文(证.statusCode)
                  }}</el-tag>
                </div>
                <div class="组织抽屉小卡次">
                  <span
                    >颁发：{{ 格式化时间(证.issuedOn) }}｜到期：{{
                      格式化时间(证.expiresOn, "长期有效")
                    }}</span
                  >
                  <el-button
                    v-if="可写 && 证.statusCode === 'active'"
                    size="small"
                    text
                    type="danger"
                    @click="撤销证书(证)"
                    >撤销</el-button
                  >
                </div>
              </div>
            </div>
            <div v-else class="组织抽屉空">暂无证书。</div>
            <div class="组织抽屉新增行">
              <el-select
                v-model="新证书表单.certificationTemplateId"
                size="small"
                placeholder="选择证书模板"
                filterable
                style="width: 220px"
              >
                <el-option
                  v-for="模板 in 证书模板列表.filter((t) => t.statusCode === 'active')"
                  :key="模板.id"
                  :label="模板.templateName"
                  :value="模板.id"
                />
              </el-select>
              <input
                v-model="新证书表单.expiresOn"
                class="form-control"
                type="date"
                style="width: 150px"
                placeholder="到期日（可选）"
              />
              <el-button size="small" type="primary" plain :loading="提交中" @click="颁发证书"
                >颁发</el-button
              >
            </div>
          </section>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.组织工作区 {
  min-height: 100vh;
  padding: 32px;
  background: #f5f5f7;
  color: #1d1d1f;
}
.组织顶栏,
.组织顶栏动作,
.组织导航,
.组织卡片标题,
.证书统计,
.同步状态 {
  display: flex;
  align-items: center;
}
.组织顶栏 {
  justify-content: space-between;
  max-width: 1440px;
  margin: 0 auto 20px;
  gap: 24px;
}
.组织顶栏 h1 {
  margin: 4px 0 0;
  font-size: 28px;
}
.组织面包屑,
.组织卡片 p,
.组织说明 {
  margin: 0;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.6;
}
.组织顶栏动作 {
  gap: 12px;
}
.返回工作台 {
  padding: 9px 14px;
  border: 1px solid #d9d9de;
  border-radius: 8px;
  background: #fff;
  color: #007aff;
  font-size: 14px;
}
.组织导航 {
  max-width: 1440px;
  margin: 0 auto 20px;
  gap: 8px;
  overflow-x: auto;
}
.组织导航 a {
  flex: none;
  padding: 9px 12px;
  border-radius: 8px;
  color: #515154;
  font-size: 14px;
}
.组织导航 a:hover,
.组织导航-激活 {
  background: #007aff;
  color: #fff !important;
}
.组织双栏 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  max-width: 1440px;
  margin: 20px auto 0;
  gap: 20px;
}
.组织卡片,
.组织加载中 {
  max-width: 1440px;
  margin: 20px auto 0;
  padding: 20px;
  border: 1px solid #e5e5ea;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.组织双栏 .组织卡片 {
  max-width: none;
  margin: 0;
}
.组织卡片标题 {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.组织卡片 h2,
.组织卡片 h3 {
  margin: 0 0 6px;
  font-size: 18px;
}
.组织卡片 h3 {
  margin-top: 28px;
}
.组织说明,
.组织错误,
.组织空状态 {
  margin-top: 16px;
}
.组织错误 {
  color: #ff3b30;
}
.组织空状态 {
  padding: 20px;
  border-radius: 10px;
  background: #f5f5f7;
  color: #6e6e73;
}
.证书统计,
.同步状态 {
  flex-wrap: wrap;
  gap: 20px;
  margin: 16px 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff8e8;
  color: #7a4b00;
}
.同步状态 {
  background: #edf6ff;
  color: #145ca8;
}
.组织全宽 {
  width: 100%;
}
@media (max-width: 900px) {
  .组织工作区 {
    padding: 20px;
  }
  .组织顶栏 {
    align-items: flex-start;
    flex-direction: column;
  }
  .组织双栏 {
    grid-template-columns: 1fr;
  }
}
</style>
