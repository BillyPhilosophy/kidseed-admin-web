<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { message } from "@/utils/message";
import { changePasswordApi, getUserInfoApi, updateMeApi } from "@/api/user";
import CoverUpload from "@/components/CoverUpload/index.vue";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({
  name: "Profile"
});

const userStore = useUserStoreHook();

/** 角色中文标签 */
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员",
  EDITOR: "内容编辑",
  PARENT: "家长"
};

const roleLabel = computed(
  () => ROLE_LABEL[userStore.roles?.[0] ?? ""] ?? "未知"
);

/* ============================== 基本资料 ============================== */

/** 头像 MinIO key（CoverUpload 的 v-model，空串 = 未设置） */
const avatarKey = ref<string>("");
const nickname = ref<string>(userStore.nickname ?? "");
const profileSaving = ref(false);

/**
 * 进入页面时拉一次`GET /v1/users/me`初始化表单：
 * store 里只存了头像 URL，key 无法可靠反推（含桶名前缀），故以接口返回的原始 avatarKey 为准
 */
const loadProfile = async () => {
  try {
    const me = await getUserInfoApi();
    avatarKey.value = me.avatarKey ?? "";
    nickname.value = me.nickname;
    userStore.syncProfile(me);
  } catch (error: any) {
    message(error?.message ?? "个人信息加载失败", { type: "error" });
  }
};

/** 上传/清除头像后立即调 PATCH /me 落库并同步 store；失败时回滚到旧 key */
const saveAvatar = async (key: string, prevKey: string) => {
  profileSaving.value = true;
  try {
    const me = await updateMeApi({ avatarKey: key || null });
    userStore.syncProfile(me);
    message(key ? "头像已更新" : "头像已清除", { type: "success" });
  } catch (error: any) {
    // 回滚本地 v-model，避免与后端不一致
    avatarKey.value = prevKey;
    message(error?.message ?? "头像保存失败", { type: "error" });
  } finally {
    profileSaving.value = false;
  }
};

const onAvatarChange = (key: string) => {
  const prevKey = avatarKey.value;
  avatarKey.value = key;
  saveAvatar(key, prevKey);
};

/** 保存昵称 */
const saveNickname = async () => {
  const value = nickname.value.trim();
  if (!value) {
    message("昵称不能为空", { type: "warning" });
    return;
  }
  if (value.length > 32) {
    message("昵称不能超过 32 个字符", { type: "warning" });
    return;
  }
  if (value === userStore.nickname) {
    message("昵称未变化", { type: "info" });
    return;
  }
  profileSaving.value = true;
  try {
    const me = await updateMeApi({ nickname: value });
    userStore.syncProfile(me);
    message("昵称已更新", { type: "success" });
  } catch (error: any) {
    message(error?.message ?? "昵称保存失败", { type: "error" });
  } finally {
    profileSaving.value = false;
  }
};

/* ============================== 修改密码 ============================== */

const pwdFormRef = ref<FormInstance>();
const pwdLoading = ref(false);
const pwdForm = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: ""
});

const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: "请输入旧密码", trigger: "blur" }],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (value.length < 8 || value.length > 72) {
          callback(new Error("新密码长度须为 8~72 位"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  confirmPassword: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== pwdForm.newPassword) {
          callback(new Error("两次输入的新密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
};

/** 提交改密：成功后统一退出登录、跳登录页重新登录 */
const submitPassword = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate(async valid => {
    if (!valid) return;
    pwdLoading.value = true;
    try {
      await changePasswordApi({
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      });
      message("密码已修改，请重新登录", { type: "success" });
      // 改密成功后旧令牌已被吊销，统一走退出登录流程回登录页
      await userStore.logOut();
    } catch (error: any) {
      // 401 旧密码错误等，error.message 已是后端中文提示
      message(error?.message ?? "密码修改失败", { type: "error" });
    } finally {
      pwdLoading.value = false;
    }
  });
};

onMounted(loadProfile);
</script>

<template>
  <div class="profile-page">
    <el-row :gutter="16">
      <!-- 基本资料 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="profile-card">
          <template #header>
            <span class="card-title">基本资料</span>
          </template>
          <el-form label-width="72px" label-position="left">
            <el-form-item label="头像">
              <CoverUpload
                :model-value="avatarKey"
                @update:model-value="onAvatarChange"
              />
            </el-form-item>
            <el-form-item label="昵称">
              <div class="nickname-row">
                <el-input
                  v-model="nickname"
                  maxlength="32"
                  show-word-limit
                  placeholder="1~32 个字符"
                  class="nickname-input"
                />
                <el-button
                  type="primary"
                  :loading="profileSaving"
                  @click="saveNickname"
                >
                  保存
                </el-button>
              </div>
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input :model-value="userStore.username" disabled />
            </el-form-item>
            <el-form-item label="角色">
              <el-tag effect="plain">{{ roleLabel }}</el-tag>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 修改密码 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="profile-card">
          <template #header>
            <span class="card-title">修改密码</span>
          </template>
          <el-form
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            label-width="96px"
            label-position="left"
          >
            <el-form-item label="旧密码" prop="oldPassword">
              <el-input
                v-model="pwdForm.oldPassword"
                type="password"
                show-password
                placeholder="请输入旧密码"
              />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="pwdForm.newPassword"
                type="password"
                show-password
                placeholder="8~72 位"
              />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirmPassword">
              <el-input
                v-model="pwdForm.confirmPassword"
                type="password"
                show-password
                placeholder="再次输入新密码"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="pwdLoading"
                @click="submitPassword(pwdFormRef)"
              >
                确认修改
              </el-button>
            </el-form-item>
          </el-form>
          <div class="pwd-tip">修改成功后需要重新登录</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.profile-page {
  padding: 16px;
}

.profile-card {
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-lighter);
}

.card-title {
  font-size: 15px;
  font-weight: 600;
}

.nickname-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.nickname-input {
  flex: 1;
}

.pwd-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
