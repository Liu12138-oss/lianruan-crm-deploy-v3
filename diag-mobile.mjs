import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { 创建应用 } from "./apps/api/src/index.js";

const 环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  MESSAGE_WORKER_ENABLED: "true",
  MESSAGE_EVENT_CUTOVER_AT: "2026-08-17T00:00:00+08:00",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    { username: "mobile_admin", passwordHash: "", roles: ["superadmin"], regionCode: "" },
  ]),
});
const app = 创建应用({ env: 环境变量 });
const agent = request.agent(app);
const 登录 = await agent.post("/api/auth/login").send({ username: "mobile_admin", password: "LrCRM@2026!" });
console.log("登录", 登录.status);
const 幂等键 = "mobile-registration-retry-001";
const 首次 = await agent.post("/api/mobile/registrations").set("Authorization", `Bearer x`).set("Idempotency-Key", 幂等键).send({ customerName: "移动端幂等诊断客户", contact: "测试联系人" });
console.log("首次", 首次.status, JSON.stringify(首次.body).slice(0, 300));
const 列表 = await agent.get("/api/mobile/registrations?page=1&pageSize=100");
const 数据 = 列表.body?.data?.数据 ?? 列表.body?.data ?? [];
console.log("列表条数", 数据.length);
console.log("标题列表", 数据.slice(0, 10).map((项) => 项.标题));
