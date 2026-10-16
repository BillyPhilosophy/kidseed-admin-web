const Layout = () => import("@/layout/index.vue");

export default {
  path: "/users",
  name: "Users",
  component: Layout,
  redirect: "/users/index",
  meta: {
    icon: "ep:user",
    title: "用户管理",
    rank: 3
  },
  children: [
    {
      path: "/users/index",
      name: "UserManage",
      component: () => import("@/views/users/index.vue"),
      meta: {
        title: "用户管理",
        // 用户管理接口为 ADMIN 专属（EDITOR/PARENT 调用会 403）
        roles: ["ADMIN"]
      }
    }
  ]
} satisfies RouteConfigsTable;
