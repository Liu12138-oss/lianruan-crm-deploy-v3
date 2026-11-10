import type { 登录用户 } from "../../api/auth-client.js";

export type 平台角色 = "superadmin" | "region_manager" | "partner" | "unknown";

export function 判断平台角色(用户: 登录用户 | null | undefined): 平台角色 {
  const 角色文本 = `${用户?.roleName || ""} ${用户?.username || ""}`.toLowerCase();
  if (/超级管理员|系统管理员|superadmin|root/.test(角色文本)) return "superadmin";
  if (/区域管理员|区管|region_manager|admin/.test(角色文本)) return "region_manager";
  if (/渠道|销售代表|企业管理员|partner|staff/.test(角色文本)) return "partner";
  return "unknown";
}

export function 是超级管理员(用户: 登录用户 | null | undefined): boolean {
  return 判断平台角色(用户) === "superadmin";
}

export function 是区域管理员(用户: 登录用户 | null | undefined): boolean {
  return 判断平台角色(用户) === "region_manager";
}

export function 是内部管理员(用户: 登录用户 | null | undefined): boolean {
  return ["superadmin", "region_manager"].includes(判断平台角色(用户));
}

export function 可访问管理配置(用户: 登录用户 | null | undefined): boolean {
  return 是超级管理员(用户);
}

export function 可访问内部管理员维护(用户: 登录用户 | null | undefined): boolean {
  return 是超级管理员(用户);
}

export function 取最具体角色约束(
  约束列表: ReadonlyArray<readonly 平台角色[] | undefined>,
): 平台角色[] {
  const 命中约束 = [...约束列表]
    .reverse()
    .find((角色约束) => Array.isArray(角色约束) && 角色约束.length > 0);
  return 命中约束 ? [...命中约束] : [];
}
