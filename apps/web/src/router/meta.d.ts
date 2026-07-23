import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    工作区?: string;
    标题?: string;
    描述?: string;
  }
}

export {};
