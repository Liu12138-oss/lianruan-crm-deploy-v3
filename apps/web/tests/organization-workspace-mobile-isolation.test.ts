import { flushPromises, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import OrganizationWorkspacePage from "../src/pages/admin/platform-admin/OrganizationWorkspacePage.vue";

const 组织接口模拟 = vi.hoisted(() => ({
  读取组织状态: vi.fn(),
  读取组织树: vi.fn(),
  查询岗位: vi.fn(),
  查询任职: vi.fn(),
  查询负责人关系: vi.fn(),
  查询业务角色: vi.fn(),
  查询成员业务角色: vi.fn(),
  查询证书模板: vi.fn(),
  查询成员证书: vi.fn(),
  查询离职交接: vi.fn(),
  读取企微同步状态: vi.fn(),
  查询企微同步批次: vi.fn(),
  查询企微同步差异: vi.fn(),
}));

vi.mock("../src/api/organization-client.js", () => ({
  ...组织接口模拟,
  组织接口错误: class extends Error {
    错误码 = "ORG_REQUEST_FAILED";
  },
  生成组织幂等键: () => "组织测试幂等键",
  创建组织: vi.fn(),
  创建岗位: vi.fn(),
  创建业务角色: vi.fn(),
  创建证书模板: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ meta: { 组织栏目: "units" } }),
  useRouter: () => ({ replace: vi.fn() }),
}));

const 空分页结果 = { items: [], page: 1, pageSize: 10, total: 0 };
const 原始窗口宽度 = window.innerWidth;
const 页面组件存根 = Object.fromEntries(
  [
    "el-alert",
    "el-button",
    "el-dialog",
    "el-form",
    "el-form-item",
    "el-input",
    "el-input-number",
    "el-option",
    "el-select",
    "el-skeleton",
    "el-table",
    "el-table-column",
    "el-tag",
    "el-tree",
    "el-empty",
    "el-radio-group",
    "el-radio-button",
    "RouterLink",
  ].map((名称) => [名称, true]),
);

function 设置窗口宽度(宽度: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 宽度 });
}

function 设置桌面端接口响应() {
  组织接口模拟.读取组织状态.mockResolvedValue({
    enabled: true,
    writeEnabled: false,
    directorySyncEnabled: false,
  });
  组织接口模拟.读取组织树.mockResolvedValue({ items: [] });
  for (const 方法 of [
    组织接口模拟.查询岗位,
    组织接口模拟.查询任职,
    组织接口模拟.查询负责人关系,
    组织接口模拟.查询业务角色,
    组织接口模拟.查询成员业务角色,
    组织接口模拟.查询证书模板,
    组织接口模拟.查询成员证书,
    组织接口模拟.查询离职交接,
  ]) {
    方法.mockResolvedValue(空分页结果);
  }
}

afterEach(() => {
  设置窗口宽度(原始窗口宽度);
  vi.clearAllMocks();
});

describe("组织工作区移动端数据隔离", () => {
  it("窄屏直接进入不请求组织数据，切换桌面宽度后才首次加载", async () => {
    设置窗口宽度(375);
    设置桌面端接口响应();

    const 页面 = shallowMount(OrganizationWorkspacePage, {
      global: { stubs: 页面组件存根 },
    });
    await nextTick();

    expect(组织接口模拟.读取组织状态).not.toHaveBeenCalled();
    expect(组织接口模拟.读取组织树).not.toHaveBeenCalled();
    expect(组织接口模拟.查询岗位).not.toHaveBeenCalled();
    设置窗口宽度(1200);
    window.dispatchEvent(new Event("resize"));
    await flushPromises();

    expect(组织接口模拟.读取组织状态).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.读取组织树).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询岗位).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询任职).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询负责人关系).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询业务角色).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询成员业务角色).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询证书模板).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询成员证书).toHaveBeenCalledTimes(1);
    expect(组织接口模拟.查询离职交接).toHaveBeenCalledTimes(1);
    页面.unmount();
  });
});
