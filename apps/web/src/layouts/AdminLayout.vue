<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import V2TopActions from "../components/V2TopActions.vue";
import {
  判断子项激活,
  判断导航激活,
  取当前一级导航,
  可见管理端顶部导航,
} from "../shared/navigation/admin-navigation.js";
import { 判断平台角色 } from "../shared/permission/role.js";
import { useSessionStore } from "../stores/session.js";

interface 顶栏动作实例 {
  打开修改密码弹窗: () => void;
}

const 路由 = useRoute();
const 路由器 = useRouter();
const 会话 = useSessionStore();
const 顶栏动作 = ref<顶栏动作实例 | null>(null);
/** 悬停或点击展开的一级菜单简称，空串表示未展开。 */
const 展开菜单 = ref("");

const 用户简称 = computed(() => (会话.用户名 || "用户").slice(0, 1));
const 导航项 = computed(() => 可见管理端顶部导航(会话.user));
const 二级菜单 = computed(() => 取当前一级导航(路由.path, 导航项.value));
const 模块主操作 = computed(() => {
  const 路径 = 路由.path;
  if (路径 === "/admin/registration/new") return null;
  if (路径.startsWith("/admin/registration")) return { 文案: "新建客户", 目标: "/admin/registration/new" };
  if (路径 === "/admin/opportunity/new") return null;
  if (路径.startsWith("/admin/opportunity")) return { 文案: "新建商机", 目标: "/admin/opportunity/new" };
  if (路径.startsWith("/admin/quote/")) return null;
  if (路径.startsWith("/admin/quote")) return { 文案: "新建报价", 目标: "/admin/quote/new" };
  return null;
});
const 角色名称 = computed(() => {
  const 角色 = 判断平台角色(会话.user);
  if (角色 === "superadmin") return "超级管理员";
  if (角色 === "region_manager") return "区域管理员";
  return 会话.角色名 || "平台用户";
});

function 修改密码() {
  顶栏动作.value?.打开修改密码弹窗();
}

async function 退出() {
  await 会话.退出系统();
  await 路由器.push("/login");
}
</script>

<template>
  <main
    class="v2-桌面布局 v2-管理端布局 v2-顶部导航布局"
    :class="{ 'v2-带二级导航': !!二级菜单 }"
  >
    <header class="v2-顶部业务导航">
      <RouterLink class="v2-导航品牌" to="/admin/dashboard" aria-label="联软渠道管理平台">
        <span class="v2-导航品牌标识">L</span>
        <span class="v2-导航品牌文字">
          <strong>联软渠道管理平台</strong>
          <small>Channel Management</small>
        </span>
      </RouterLink>

      <nav class="v2-一级导航" aria-label="管理端一级导航">
        <div
          v-for="item in 导航项"
          :key="item.路径"
          class="v2-一级导航组"
          @mouseenter="展开菜单 = item.子项?.length ? item.简称 : ''"
          @mouseleave="展开菜单 = ''"
        >
          <RouterLink
            class="v2-一级导航项"
            :class="{ active: 判断导航激活(路由.path, item) }"
            :to="item.路径"
            :title="item.名称"
            @click="展开菜单 = ''"
          >
            <span>{{ item.简称 }}</span>
            <i v-if="item.子项?.length" class="v2-一级导航箭头" aria-hidden="true"></i>
          </RouterLink>
          <div v-if="item.子项?.length && 展开菜单 === item.简称" class="v2-二级导航浮层">
            <RouterLink
              v-for="子项 in item.子项"
              :key="子项.路径"
              class="v2-二级导航项"
              :class="{ active: 判断子项激活(路由.path, 子项) }"
              :to="子项.路径"
              @click="展开菜单 = ''"
            >
              <strong>{{ 子项.名称 }}</strong>
              <small>{{ 子项.描述 }}</small>
            </RouterLink>
          </div>
        </div>
      </nav>

      <div class="v2-顶部业务动作">
        <RouterLink v-if="模块主操作" class="v2-顶部主操作" :to="模块主操作.目标">
          ＋ {{ 模块主操作.文案 }}
        </RouterLink>
        <RouterLink class="v2-顶部图标" to="/admin/notifications" title="消息中心">🔔</RouterLink>
        <V2TopActions ref="顶栏动作" :用户名="会话.用户名" />
        <span class="v2-顶部用户">
          <span class="v2-顶部头像">{{ 用户简称 }}</span>
          <span class="v2-顶部用户文案">
            <strong>{{ 会话.用户名 }}</strong>
            <small>{{ 角色名称 }}</small>
          </span>
          <button class="v2-修改密码" type="button" title="修改密码" @click="修改密码">
            修改密码
          </button>
          <button class="v2-顶部退出" type="button" title="退出登录" @click="退出">退出</button>
        </span>
      </div>
    </header>

    <nav v-if="二级菜单?.子项?.length" class="v2-二级导航条" aria-label="管理配置二级导航">
      <span class="v2-二级导航条标题">{{ 二级菜单.名称 }}</span>
      <RouterLink
        v-for="子项 in 二级菜单.子项"
        :key="子项.路径"
        class="v2-二级导航条项"
        :class="{ active: 判断子项激活(路由.path, 子项) }"
        :to="子项.路径"
      >
        {{ 子项.名称 }}
      </RouterLink>
    </nav>

    <section class="v2-内容区">
      <main class="v2-页面内容">
        <RouterView />
      </main>
    </section>
  </main>
</template>
