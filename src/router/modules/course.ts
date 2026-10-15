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
        // 单角色管理后台：仅 ADMIN 可见可访问
        roles: ["ADMIN"]
      }
    }
  ]
} satisfies RouteConfigsTable;
