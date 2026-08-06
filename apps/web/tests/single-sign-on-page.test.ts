import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import SingleSignOnPage from "../src/pages/SingleSignOnPage.vue";

const 空页面 = { template: "<div></div>" };

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("平台专属单点登录页", () => {
  it("UniSDP平台单点登录失败后回到统一认证页面", async () => {
    const fetchMock = 模拟单点登录失败();

    const { router, wrapper } = await 挂载单点登录页("/sso/unisdp?ssotoken=bad-token");

    expect(router.currentRoute.value.path).toBe("/login");
    expect(router.currentRoute.value.query).toEqual({
      ssoFallback: "1",
      provider: "unisdp",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sso/unisdp/login",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );

    wrapper.unmount();
  });

  it("IAM平台单点登录失败后回到统一认证页面", async () => {
    const fetchMock = 模拟单点登录失败();

    const { router, wrapper } = await 挂载单点登录页("/sso/iam?token=bad-token");

    expect(router.currentRoute.value.path).toBe("/login");
    expect(router.currentRoute.value.query).toEqual({
      ssoFallback: "1",
      provider: "iam",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sso/iam/login",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );

    wrapper.unmount();
  });
});

async function 挂载单点登录页(path: string) {
  window.history.pushState({}, "", path);
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/login", component: 空页面 },
      { path: "/sso/iam", component: SingleSignOnPage },
      { path: "/sso/unisdp", component: SingleSignOnPage },
      { path: "/login/singlesignonlogin/login.do", component: SingleSignOnPage },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(SingleSignOnPage, {
    global: {
      plugins: [createPinia(), router],
    },
  });
  await flushPromises();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await flushPromises();
  return { router, wrapper };
}

function 模拟单点登录失败() {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { message: "单点登录失败，请使用账号密码登录。" },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
