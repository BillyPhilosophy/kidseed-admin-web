const Layout = () => import("@/layout/index.vue");

export default {
  path: "/course",
  name: "Course",
  component: Layout,
  redirect: "/course/index",
  meta: {
    icon: "ep:notebook",
    title: "课程管理",
    rank: 1
  },
  children: [
    {
      path: "/course/index",
      name: "CourseManage",
      component: () => import("@/views/course/index.vue"),
      meta: {
        title: "课程管理",
        // ADMIN 与 EDITOR 可见可访问（EDITOR 能编辑不能发布，按钮级权限另行控制）
        roles: ["ADMIN", "EDITOR"]
      }
    }
  ]
} satisfies RouteConfigsTable;
