import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { 创建应用 } from "../src/index.js";

const 测试环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: "[]",
});

if (!测试环境变量.DATABASE_URL) {
  throw new Error("V2兼容接口测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

describe("V2真实页面兼容接口", () => {
  it("迁移用户可以通过V2登录格式获取用户和令牌", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 用户列表 = await request(app).get("/api/v2/users?pageSize=1000").expect(200);
    const 用户 =
      (用户列表.body.data as Array<{ username: string }>).find(
        (item) => item.username === "liulonghai",
      ) || (用户列表.body.data as Array<{ username: string }>)[0];

    if (!用户?.username) throw new Error("未找到可用于V2兼容登录测试的迁移用户。");
    const 登录 = await request(app)
      .post("/api/v2/auth/login")
      .send({ username: 用户.username, password: "LrCRM@2026!" })
      .expect(200);

    expect(登录.body.success).toBe(true);
    expect(登录.body.user.username).toBe(用户.username);
    expect(登录.body.token).toMatch(/^v2\./);

    const 统一入口登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: 用户.username, password: "LrCRM@2026!" })
      .expect(200);
    expect(统一入口登录.body.data.user.username).toBe(用户.username);
    expect(统一入口登录.body.data.pageSession.token).toMatch(/^v2\./);
    expect(统一入口登录.body.data.pageSession.user.username).toBe(用户.username);
    expect(统一入口登录.body.data.pageSession.user.id).toBeTruthy();
  });

  it("V2登录页可以读取未启用的OAuth配置", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 响应 = await request(app).get("/api/v2/oauth/config").expect(200);

    expect(响应.body.success).toBe(true);
    expect(响应.body.enabled).toBe(false);
    expect(响应.body.data.enabled).toBe(false);
  });

  it("账号联系电话在创建和修改时必须保持唯一", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 批次 = `phone_unique_${Date.now()}`;
    const 电话一 = `139${String(Date.now()).slice(-8)}`;
    const 电话二 = `138${String(Date.now()).slice(-8)}`;

    const 账号一 = await request(app)
      .post("/api/v2/users")
      .send({
        username: `${批次}_a`,
        name: `${批次}-账号甲`,
        role: "staff",
        phone: 电话一,
        status: "active",
      })
      .expect(200);
    expect(账号一.body.success).toBe(true);

    const 创建冲突 = await request(app)
      .post("/api/v2/users")
      .send({
        username: `${批次}_b`,
        name: `${批次}-账号乙`,
        role: "staff",
        phone: 电话一,
        status: "active",
      })
      .expect(409);
    expect(创建冲突.body.success).toBe(false);
    expect(创建冲突.body.error).toContain("联系电话已被账号");

    const 账号二 = await request(app)
      .post("/api/v2/users")
      .send({
        username: `${批次}_b`,
        name: `${批次}-账号乙`,
        role: "staff",
        phone: 电话二,
        status: "active",
      })
      .expect(200);
    expect(账号二.body.success).toBe(true);

    const 修改冲突 = await request(app)
      .put(`/api/v2/users/${encodeURIComponent(`${批次}_b`)}`)
      .send({
        username: `${批次}_b`,
        name: `${批次}-账号乙`,
        role: "staff",
        phone: 电话一,
        status: "active",
      })
      .expect(409);
    expect(修改冲突.body.success).toBe(false);
    expect(修改冲突.body.error).toContain("联系电话已被账号");
  });

  it("产品目录按V2数组格式返回功能、硬件、套餐和树结构", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [功能, 硬件, 套餐, 树] = await Promise.all([
      request(app).get("/api/v2/features").expect(200),
      request(app).get("/api/v2/hardware").expect(200),
      request(app).get("/api/v2/packages").expect(200),
      request(app).get("/api/v2/product-tree").expect(200),
    ]);

    expect(功能.body.data).toHaveLength(34);
    expect(硬件.body.data).toHaveLength(15);
    expect(套餐.body.data).toHaveLength(6);
    expect(功能.body.data[0]).toHaveProperty("moduleId");
    expect(功能.body.data[0]).toHaveProperty("productCode");
    expect(硬件.body.data[0]).toHaveProperty("model");
    expect(套餐.body.data[0]).toHaveProperty("featureIds");
    expect(树.body.data.some((category: { modules?: unknown[] }) => category.modules?.length)).toBe(
      true,
    );
  });

  it("工作量映射和规则保持V2维护页可读取的数据口径", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [映射, 交付规则, 旧规则] = await Promise.all([
      request(app).get("/api/v2/workload/mappings").expect(200),
      request(app).get("/api/v2/workload/delivery-rules").expect(200),
      request(app).get("/api/v2/workload/rules").expect(200),
    ]);

    expect(映射.body.data).toHaveLength(49);
    expect(交付规则.body.data).toHaveLength(15);
    expect(旧规则.body.data.length).toBeGreaterThanOrEqual(24);
    expect(映射.body.data[0]).toHaveProperty("deliveryTags");
    expect(交付规则.body.data[0]).toHaveProperty("personDays");
    expect(旧规则.body.data[0]).toHaveProperty("minPoints");
    expect(旧规则.body.data[0]).toHaveProperty("personDays");
  });

  it("友商IPG参考对比使用V2功能编号时返回有效参考价", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 响应 = await request(app)
      .post("/api/v2/ipg/quote-preview")
      .send({
        featureIds: ["FEAT-MOD-LEP-01-01", "FEAT-MOD-LEP-01-02"],
        endpoints: 100,
        lianruanTotal: 16500,
        projectParams: { ipgEncryptionMode: "encrypt" },
      })
      .expect(200);

    expect(响应.body.success).toBe(true);
    expect(响应.body.data.ipgReferenceTotal).toBeGreaterThan(0);
    expect(响应.body.data.lianruanTotal).toBe(16500);
    expect(响应.body.data.differenceText).toContain("IPG参考总价");
  });

  it("V2后台常用维护入口不再返回404", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [企业搜索, 导出, 导入模板, 文档, 简介产品, 地市] = await Promise.all([
      request(app).get("/api/v2/company-search?keyword=公司").expect(200),
      request(app).get("/api/v2/export/registrations").expect(200),
      request(app).get("/api/v2/import/registrations/template").expect(200),
      request(app).get("/api/v2/open-api/docs").expect(200),
      request(app).get("/api/v2/partner-profile-products").expect(200),
      request(app).get("/api/v2/meta/prefecture-cities").expect(200),
    ]);

    expect(企业搜索.body.success).toBe(true);
    expect(Array.isArray(企业搜索.body.data)).toBe(true);
    expect(导出.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(导入模板.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(文档.body.data).toHaveLength(2);
    expect(Array.isArray(简介产品.body.data.products)).toBe(true);
    expect(Array.isArray(地市.body.data)).toBe(true);
  });

  it("V2导入导出真实解析Excel并写入PostgreSQL，兼容裸/api/import路径", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const { 渠道商名称, 员工姓名 } = await 读取可导入负责人(app);
    const 客户名称 = `阶段9导入客户-${Date.now()}`;
    const 导入联系电话 = `137${String(Date.now()).slice(-8)}`;
    const 报备文件 = 生成Excel([
      [
        "客户名称*",
        "统一社会信用代码",
        "行业",
        "联系人",
        "联系电话",
        "负责员工姓名*",
        "所属渠道商名称*",
        "客户地址",
      ],
      [客户名称, "", "制造", "验收联系人", 导入联系电话, 员工姓名, 渠道商名称, "阶段9验收地址"],
    ]);

    const 预览 = await request(app)
      .post("/api/import/registrations/preview")
      .attach("file", 报备文件, {
        filename: "客户报备导入.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(预览.body.success).toBe(true);
    expect(预览.body.totalCount).toBe(1);
    expect(预览.body.errorCount).toBe(0);

    const 执行报备 = await request(app)
      .post("/api/import/registrations/execute")
      .attach("file", 报备文件, {
        filename: "客户报备导入.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(执行报备.body.success).toBe(true);
    expect(执行报备.body.results.success + 执行报备.body.results.updated).toBeGreaterThanOrEqual(1);

    const 导入报备回读 = await request(app)
      .get(`/api/v2/registrations?keyword=${encodeURIComponent(客户名称)}&pageSize=10`)
      .expect(200);
    const 导入报备 = 导入报备回读.body.data.find(
      (item: { customer?: string }) => item.customer === 客户名称,
    );
    expect(导入报备?.id).toMatch(/^BB-.+-\d{8}-\d{4}$/);

    const 商机文件 = 生成Excel([
      [
        "商机名称*",
        "客户名称*",
        "商机金额",
        "预计签约日期",
        "商机阶段",
        "行业",
        "联系人",
        "联系电话",
        "负责员工姓名*",
        "所属渠道商名称*",
        "备注",
      ],
      [
        `${客户名称}安全项目`,
        客户名称,
        "50000",
        "2026-08-31",
        "40% 技术交流/方案设计",
        "制造",
        "验收联系人",
        "13800138009",
        员工姓名,
        渠道商名称,
        "阶段9导入验收",
      ],
    ]);
    const 执行商机 = await request(app)
      .post("/api/v2/import/opportunities/execute")
      .attach("file", 商机文件, {
        filename: "商机导入.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(执行商机.body.success).toBe(true);
    expect(执行商机.body.results.success + 执行商机.body.results.updated).toBeGreaterThanOrEqual(1);

    const 商机回读 = await request(app)
      .get(`/api/v2/opportunities?keyword=${encodeURIComponent(客户名称)}&pageSize=10`)
      .expect(200);
    const 导入商机 = 商机回读.body.data.find(
      (item: { name?: string }) => item.name === `${客户名称}安全项目`,
    );
    expect(导入商机?.code).toMatch(/^SJ-\d{8}-\d{4}$/);

    const 回读 = await request(app)
      .get(`/api/v2/registrations?keyword=${encodeURIComponent(客户名称)}`)
      .expect(200);
    expect(回读.body.data.some((item: { customer?: string }) => item.customer === 客户名称)).toBe(
      true,
    );
  });

  it("审计日志按V2维护页字段返回列表和详情", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 列表 = await request(app).get("/api/v2/audit-logs?pageSize=5").expect(200);

    expect(列表.body.success).toBe(true);
    expect(Array.isArray(列表.body.data)).toBe(true);
    expect(列表.body.total).toBeGreaterThan(0);
    const 第一条 = 列表.body.data[0] as { id: string };
    expect(第一条).toHaveProperty("created_at");
    expect(第一条).toHaveProperty("module");
    expect(第一条).toHaveProperty("action");
    expect(第一条).toHaveProperty("result");

    const 详情 = await request(app).get(`/api/v2/audit-logs/${第一条.id}`).expect(200);
    expect(详情.body.success).toBe(true);
    expect(详情.body.data.id).toBe(第一条.id);
  });

  it("渠道简介、分销层级、工作量规则和订单调价按V2路径写入PostgreSQL", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 渠道商列表 = await request(app).get("/api/v2/partners?pageSize=1").expect(200);
    const 渠道商 = 渠道商列表.body.data[0] as { id: string };
    expect(渠道商.id).toBeTruthy();

    const 简介 = await request(app).get(`/api/v2/partners/${渠道商.id}/profile`).expect(200);
    expect(简介.body.success).toBe(true);
    const 保存简介 = await request(app)
      .put(`/api/v2/partners/${渠道商.id}/profile`)
      .send({ address: "阶段9自动验收地址", verified: true })
      .expect(200);
    expect(保存简介.body.data.address).toBe("阶段9自动验收地址");

    const 层级 = await request(app)
      .put(`/api/v2/partners/${渠道商.id}/level`)
      .send({ partnerLevel: "none", parentPartnerIds: [] })
      .expect(200);
    expect(层级.body.data.partnerLevel).toBe("none");

    const 新规则 = await request(app)
      .post("/api/v2/workload/rules")
      .send({ productType: "EPP", minPoints: 260001, maxPoints: null, personDays: 18 })
      .expect(200);
    expect(新规则.body.success).toBe(true);
    await request(app).delete(`/api/v2/workload/rules/${新规则.body.data.id}`).expect(200);

    const 订单列表 = await request(app).get("/api/v2/orders?pageSize=1").expect(200);
    const 订单 = 订单列表.body.data[0] as { id: string; amount?: number; total?: number };
    if (订单?.id) {
      const 调价 = await request(app)
        .put(`/api/v2/orders/${订单.id}/price-adjust`)
        .send({
          newAmount: Number(订单.amount || 订单.total || 1),
          adjustmentReason: "阶段9自动验收",
        })
        .expect(200);
      expect(调价.body.success).toBe(true);
      expect(调价.body.data.id).toBe(订单.id);
      expect(调价.body.data.status).toBe("pending_superadmin_confirm");
    }
  });

  it("渠道商员工禁用后保留在团队中，删除后刷新不再返回该员工", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 序号 = Date.now();
    const 渠道商编号 = `PARTNER-STAFF-DELETE-${序号}`;
    const 员工账号 = `staff_delete_${序号}`;
    const 渠道联系电话 = `135${String(序号).slice(-8)}`;
    const 员工电话 = `136${String(序号).slice(-8)}`;

    await request(app)
      .post("/api/v2/partners")
      .send({
        id: 渠道商编号,
        name: `删除员工验收渠道商-${序号}`,
        city: "深圳市",
        contact: "验收负责人",
        phone: 渠道联系电话,
        status: "active",
      })
      .expect(200);

    await request(app)
      .post(`/api/v2/partners/${渠道商编号}/staff`)
      .send({
        username: 员工账号,
        name: "删除员工验收账号",
        role: "staff",
        accountRole: "staff",
        staffRole: "销售代表",
        password: "123456",
        phone: 员工电话,
        status: "active",
      })
      .expect(200);

    const 创建后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
    expect(查找员工(创建后详情.body.data, 员工账号)?.status).toBe("active");

    await request(app)
      .put(`/api/v2/partners/${渠道商编号}/staff/${员工账号}/status`)
      .send({ status: "inactive" })
      .expect(200);

    const 禁用后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
    expect(查找员工(禁用后详情.body.data, 员工账号)?.status).toBe("inactive");

    await request(app).delete(`/api/v2/partners/${渠道商编号}/staff/${员工账号}`).expect(200);

    const 删除后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
    expect(查找员工(删除后详情.body.data, 员工账号)).toBeUndefined();
  });
});

function 生成Excel(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "导入数据");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function 读取可导入负责人(app: ReturnType<typeof 创建应用>) {
  const 渠道商列表 = await request(app).get("/api/v2/partners?pageSize=1000").expect(200);
  const 渠道商 = (渠道商列表.body.data as Array<Record<string, unknown>>).find(
    (item) =>
      Array.isArray(item.staff) &&
      item.staff.some((staff) => staff?.name && staff.status !== "deleted"),
  );
  const 员工记录 = Array.isArray(渠道商?.staff)
    ? (渠道商.staff.find((staff) => staff?.name && staff.status !== "deleted") as
        { name?: string } | undefined)
    : undefined;
  if (!渠道商?.name || !员工记录?.name) {
    throw new Error("未找到可用于导入验收的渠道商员工。");
  }
  return { 渠道商名称: String(渠道商.name), 员工姓名: String(员工记录.name) };
}

function 查找员工(partner: { staff?: Array<Record<string, unknown>> }, username: string) {
  return partner.staff?.find((staff) => String(staff.username || "") === username);
}
