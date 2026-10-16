const { VITE_HIDE_HOME } = import.meta.env;
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/welcome",
  meta: {
    icon: "ep/home-filled",
    title: "首页",
    rank: 0
  },
  children: [
    {
      path: "/welcome",
      name: "Welcome",
      component: () => import("@/views/welcome/index.vue"),
      meta: {
        title: "首页",
        showLink: VITE_HIDE_HOME === "true" ? false : true,
        // ADMIN 与 EDITOR 可见可访问（EDITOR 登录后首页可见，仅部分卡片不可操作）
        roles: ["ADMIN", "EDITOR"]
      }
    },
    {
      path: "/profile",
      name: "Profile",
      component: () => import("@/views/profile/index.vue"),
      meta: {
        title: "个人信息",
        // 不进侧边栏菜单，从导航栏用户下拉进入
        showLink: false,
        roles: ["ADMIN", "EDITOR"]
      }
    }
  ]
} satisfies RouteConfigsTable;
