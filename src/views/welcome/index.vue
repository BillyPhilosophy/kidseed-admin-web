<script setup lang="ts">
import dayjs from "dayjs";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getTreeApi } from "@/api/admin";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({
  name: "Welcome"
});

const router = useRouter();
const userStore = useUserStoreHook();

/** 角色中文标签 */
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员",
  EDITOR: "内容编辑"
};

const roleLabel = computed(
  () => ROLE_LABEL[userStore.roles?.[0] ?? ""] ?? "访客"
);

/** 星期中文名（dayjs().day()：0=周日） */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const todayText = computed(() => {
  const now = dayjs();
  return `今天是 ${now.format("M月D日")} 星期${WEEKDAYS[now.day()]}`;
});

/** 按时段的问候语 */
const greeting = computed(() => {
  const hour = dayjs().hour();
  if (hour < 6) return "夜深了，注意休息";
  if (hour < 9) return "早上好，新的一天开始了";
  if (hour < 12) return "上午好，工作顺利";
  if (hour < 14) return "中午好，记得休息片刻";
  if (hour < 18) return "下午好，继续保持";
  return "晚上好，辛苦了";
});

/* ============================== 统计卡片 ============================== */

const loading = ref(true);
const stats = ref({
  unitCount: 0,
  lessonCount: 0,
  reviewingCount: 0,
  publishedCount: 0
});

const isAdmin = computed(() => userStore.roles?.includes("ADMIN"));

/** 拉取课程树并聚合统计（复用现有 GET /v1/admin/tree，不新增接口） */
const loadStats = async () => {
  loading.value = true;
  try {
    const tree = await getTreeApi();
    let lessonCount = 0;
    let reviewingCount = 0;
    let publishedCount = 0;
    for (const unit of tree) {
      lessonCount += unit.lessons.length;
      for (const lesson of unit.lessons) {
        for (const version of lesson.versions) {
          if (version.status === "REVIEWING") reviewingCount += 1;
          else if (version.status === "PUBLISHED") publishedCount += 1;
        }
      }
    }
    stats.value = {
      unitCount: tree.length,
      lessonCount,
      reviewingCount,
      publishedCount
    };
  } catch (error: any) {
    message(error?.message ?? "统计数据加载失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

/** 待审核卡片点击：仅 ADMIN 可跳转课程管理审核 */
const goReview = () => {
  if (!isAdmin.value) return;
  router.push("/course");
};

const go = (path: string) => router.push(path);

onMounted(loadStats);
</script>

<template>
  <div class="welcome-page">
    <!-- 问候卡 -->
    <el-card shadow="never" class="greeting-card">
      <div class="greeting-body">
        <div>
          <div class="greeting-title">
            {{ greeting }}，{{ userStore.nickname || userStore.username }}
            <el-tag size="small" effect="plain" class="role-tag">
              {{ roleLabel }}
            </el-tag>
          </div>
          <div class="greeting-sub">{{ todayText }}，欢迎回到工作台</div>
        </div>
      </div>
    </el-card>

    <!-- 统计卡片 -->
    <div class="section-title">数据概览</div>
    <el-skeleton :loading="loading" animated :rows="3">
      <el-row :gutter="16">
        <el-col :xs="12" :sm="12" :md="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value">{{ stats.unitCount }}</div>
            <div class="stat-label">单元总数</div>
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value">{{ stats.lessonCount }}</div>
            <div class="stat-label">课程总数</div>
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <el-card
            shadow="hover"
            class="stat-card"
            :class="{ clickable: isAdmin }"
            @click="goReview"
          >
            <div class="stat-value warning">{{ stats.reviewingCount }}</div>
            <div class="stat-label">
              待审核版本
              <span v-if="isAdmin" class="stat-hint">点击前往审核</span>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value success">{{ stats.publishedCount }}</div>
            <div class="stat-label">已发布版本</div>
          </el-card>
        </el-col>
      </el-row>
    </el-skeleton>

    <!-- 快捷入口 -->
    <div class="section-title">快捷入口</div>
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="entry-card" @click="go('/course')">
          <div class="entry-body">
            <el-icon :size="28" color="var(--el-color-primary)">
              <component :is="useRenderIcon('ep:notebook')" />
            </el-icon>
            <div>
              <div class="entry-title">课程管理</div>
              <div class="entry-desc">单元、课程与版本内容维护</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col v-perms="'user:manage'" :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="entry-card" @click="go('/users')">
          <div class="entry-body">
            <el-icon :size="28" color="var(--el-color-primary)">
              <component :is="useRenderIcon('ep:user')" />
            </el-icon>
            <div>
              <div class="entry-title">用户管理</div>
              <div class="entry-desc">平台账号与角色管理</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col v-perms="'llm:ping'" :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="entry-card" @click="go('/tools')">
          <div class="entry-body">
            <el-icon :size="28" color="var(--el-color-primary)">
              <component :is="useRenderIcon('ep:briefcase')" />
            </el-icon>
            <div>
              <div class="entry-title">工具箱</div>
              <div class="entry-desc">TTS 试听与 LLM 连通性自检</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.welcome-page {
  padding: 16px;
}

.greeting-card {
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.greeting-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.greeting-title {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.role-tag {
  font-weight: 400;
}

.greeting-sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.section-title {
  margin: 20px 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-card {
  margin-bottom: 16px;
  text-align: center;
  border: 1px solid var(--el-border-color-lighter);

  &.clickable {
    cursor: pointer;
  }
}

.stat-value {
  font-size: 30px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-color-primary);

  &.warning {
    color: var(--el-color-warning);
  }

  &.success {
    color: var(--el-color-success);
  }
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-hint {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
}

.entry-card {
  margin-bottom: 16px;
  cursor: pointer;
  border: 1px solid var(--el-border-color-lighter);
}

.entry-body {
  display: flex;
  gap: 14px;
  align-items: center;
}

.entry-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.entry-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
