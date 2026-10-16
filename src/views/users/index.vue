<script setup lang="ts">
import { onMounted, ref } from "vue";
import dayjs from "dayjs";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import type { AdminUserItem } from "@/api/admin";
import { getAdminUsersApi, updateUserRoleApi } from "@/api/admin";
import type { UserRole } from "@/api/user";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({ name: "UserManage" });

/** 用户管理页（仅 ADMIN）：关键字搜索 + 用户列表 + 修改角色 */

const userStore = useUserStoreHook();

/* ---------------- 列表 ---------------- */

const loading = ref(false);
const keyword = ref("");
const userList = ref<AdminUserItem[]>([]);

/** 拉取用户列表（空关键字 = 全量，后端最多返回 50 条） */
const loadUsers = async () => {
  loading.value = true;
  try {
    userList.value = await getAdminUsersApi(keyword.value.trim() || undefined);
  } catch (error: any) {
    // 400/403 等：error.message 已是后端中文提示
    message(error?.message ?? "获取用户列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

onMounted(loadUsers);

/* ---------------- 角色展示 ---------------- */

const roleMeta: Record<
  UserRole,
  { label: string; type: "danger" | "warning" | "primary" }
> = {
  ADMIN: { label: "管理员", type: "danger" },
  EDITOR: { label: "内容编辑", type: "warning" },
  PARENT: { label: "家长", type: "primary" }
};

const fmtTime = (time?: string | null): string =>
  time ? dayjs(time).format("YYYY-MM-DD HH:mm") : "—";

/** 是否当前登录用户自己（优先比 id，id 缺失时退化比邮箱） */
const isSelf = (row: AdminUserItem): boolean =>
  userStore.id ? row.id === userStore.id : row.email === userStore.username;

/* ---------------- 修改角色 ---------------- */

const roleDialogVisible = ref(false);
const roleSubmitting = ref(false);
const roleTarget = ref<AdminUserItem | null>(null);
const selectedRole = ref<UserRole>("PARENT");

const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: "管理员", value: "ADMIN" },
  { label: "内容编辑", value: "EDITOR" },
  { label: "家长", value: "PARENT" }
];

const openRoleDialog = (row: AdminUserItem) => {
  roleTarget.value = row;
  selectedRole.value = row.role;
  roleDialogVisible.value = true;
};

const handleUpdateRole = async () => {
  if (!roleTarget.value) return;
  if (selectedRole.value === roleTarget.value.role) {
    message("目标角色与当前角色一致，无需修改", { type: "warning" });
    return;
  }
  const target = roleTarget.value;
  try {
    await ElMessageBox.confirm(
      `确定将「${target.nickname || target.email}」的角色修改为「${roleMeta[selectedRole.value].label}」吗？修改后该用户所有登录状态将失效，需重新登录。`,
      "修改角色确认",
      {
        type: "warning",
        confirmButtonText: "确认修改",
        cancelButtonText: "取消"
      }
    );
  } catch {
    return; // 用户取消
  }
  roleSubmitting.value = true;
  try {
    await updateUserRoleApi(target.id, selectedRole.value);
    message(
      `已将「${target.nickname || target.email}」的角色修改为「${roleMeta[selectedRole.value].label}」`,
      {
        type: "success"
      }
    );
    roleDialogVisible.value = false;
    loadUsers();
  } catch (error: any) {
    // 400（不能修改自己的角色/role 非法）、404（用户不存在）：error.message 已是后端中文提示
    message(error?.message ?? "修改角色失败", { type: "error" });
  } finally {
    roleSubmitting.value = false;
  }
};
</script>

<template>
  <div class="user-manage">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索邮箱 / 昵称"
        class="keyword-input"
        @keyup.enter="loadUsers"
        @clear="loadUsers"
      />
      <el-button type="primary" :loading="loading" @click="loadUsers">
        搜索
      </el-button>
      <el-button :loading="loading" @click="loadUsers">刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="userList" border stripe>
      <el-table-column prop="email" label="邮箱" min-width="200" />
      <el-table-column label="昵称" min-width="140">
        <template #default="{ row }">{{ row.nickname || "—" }}</template>
      </el-table-column>
      <el-table-column label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="roleMeta[row.role as UserRole].type">
            {{ roleMeta[row.role as UserRole].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="孩子档案数" width="110" align="center">
        <template #default="{ row }">{{ row._count?.children ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="注册时间" width="150">
        <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="isSelf(row)"
            :title="isSelf(row) ? '不能修改自己的角色' : ''"
            @click="openRoleDialog(row)"
          >
            修改角色
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无用户" />
      </template>
    </el-table>

    <!-- 修改角色 -->
    <el-dialog
      v-model="roleDialogVisible"
      title="修改角色"
      width="440px"
      :close-on-click-modal="false"
    >
      <div class="role-dialog-body">
        <p class="target-user">
          用户：{{ roleTarget?.nickname || "—" }}（{{ roleTarget?.email }}）
        </p>
        <el-select v-model="selectedRole" class="role-select">
          <el-option
            v-for="option in roleOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="roleSubmitting"
          @click="handleUpdateRole"
        >
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.user-manage {
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.keyword-input {
  max-width: 280px;
}

.role-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.target-user {
  margin: 0;
  color: var(--el-text-color-regular);
}

.role-select {
  width: 100%;
}
</style>
