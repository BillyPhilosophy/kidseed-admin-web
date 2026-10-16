import type { UserRole } from "@/api/user";

/**
 * 角色 → 按钮级权限（`permissions`）映射
 * 登录拉取 `users/me` 后按 `role` 推导存入 `store`，`v-perms` 指令据此判断是否渲染按钮
 * - `ADMIN`：发布/打回/回滚/LLM 自检/用户管理
 * - `EDITOR`：可编辑内容，不能发布（无按钮级权限）
 * - `PARENT`：无（进不了后台，列出仅为类型完备）
 */
export const ROLE_PERMISSIONS: Record<UserRole, Array<string>> = {
  ADMIN: [
    "version:publish",
    "version:reject",
    "version:rollback",
    "llm:ping",
    "user:manage"
  ],
  EDITOR: [],
  PARENT: []
};

/** 按角色推导按钮级权限数组（返回新数组，避免共享引用） */
export const getPermsByRole = (role: UserRole): Array<string> => [
  ...(ROLE_PERMISSIONS[role] ?? [])
];
