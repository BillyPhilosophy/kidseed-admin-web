const Layout = () => import("@/layout/index.vue");

export default {
  path: "/tools",
  name: "Tools",
  component: Layout,
  redirect: "/tools/index",
  meta: {
    icon: "ep:briefcase",
    title: "工具箱",
    rank: 2
  },
  children: [
    {
      path: "/tools/index",
      name: "ToolsIndex",
      component: () => import("@/views/tools/index.vue"),
      meta: {
        title: "工具箱",
        // 单角色管理后台：仅 ADMIN 可见可访问
        roles: ["ADMIN"]
      }
    }
  ]
} satisfies RouteConfigsTable;
