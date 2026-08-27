import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    工作区?: string;
    标题?: string;
    描述?: string;
    需要登录?: boolean;
    模块?:
      | "registrations"
      | "opportunities"
      | "quotes"
      | "orders"
      | "partners"
      | "products"
      | "users"
      | "audit"
      | "openapi"
      | "workload"
      | "importExport"
      | "approvals"
      | "notifications";
    页面动作?: "overview" | "list" | "create" | "import" | "platform";
    /** 组织架构工作区的桌面端栏目；不参与正式业务页面导航。 */
    组织栏目?:
      | "units"
      | "staff"
      | "business-roles"
      | "certifications"
      | "offboarding"
      | "directory-sync"
      | "access";
  }
}

export {};
