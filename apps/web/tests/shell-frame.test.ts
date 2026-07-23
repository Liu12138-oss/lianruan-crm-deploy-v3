import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ShellFrame from "../src/components/ShellFrame.vue";

describe("基础布局组件", () => {
  it("能够渲染中文标题和内容插槽", () => {
    const wrapper = mount(ShellFrame, {
      props: { title: "管理端", subtitle: "测试布局", tone: "admin" },
      slots: { default: "<p>阶段1内容</p>" },
    });
    expect(wrapper.text()).toContain("管理端");
    expect(wrapper.text()).toContain("阶段1内容");
  });
});
