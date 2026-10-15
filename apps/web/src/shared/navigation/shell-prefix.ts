import { computed, type ComputedRef } from "vue";
import { useRoute } from "vue-router";

/**
 * 管理端与渠道端复用同一批业务组件，页面内跳转必须跟随当前外壳前缀。
 * 否则渠道账号（/partner）会跳到只有内部管理员可访问的 /admin 路由。
 */
export function use外壳前缀(): ComputedRef<"/admin" | "/partner"> {
  const 路由 = useRoute();
  return computed(() => (路由.path.startsWith("/partner") ? "/partner" : "/admin"));
}
