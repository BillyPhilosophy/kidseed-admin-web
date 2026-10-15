<script setup lang="ts">
import { h, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import type { LessonDetail, ValidationIssue, VersionDetail } from "@/api/admin";
import {
  getLessonApi,
  publishVersionApi,
  rejectVersionApi,
  rollbackLessonApi,
  submitVersionApi
} from "@/api/admin";
import { fmtTime, statusMeta } from "../utils";
import VersionContentDialog from "./VersionContentDialog.vue";
import PreviewDialog from "./PreviewDialog.vue";

/** 版本面板：展示选中课程的版本列表，并按状态提供操作（送审/打回/发布/回滚/预览/编辑） */
const props = defineProps<{
  /** 选中课程 id；空串表示未选中 */
  lessonId: string;
}>();

const emit = defineEmits<{
  /** 版本或课程状态发生变化，通知父级刷新课程树 */
  changed: [];
}>();

const loading = ref(false);
const lesson = ref<LessonDetail | null>(null);

/** 拉取课程详情（含完整版本列表） */
const loadLesson = async () => {
  if (!props.lessonId) {
    lesson.value = null;
    return;
  }
  loading.value = true;
  try {
    lesson.value = await getLessonApi(props.lessonId);
  } catch (error: any) {
    lesson.value = null;
    message(error?.message ?? "获取课程详情失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

watch(() => props.lessonId, loadLesson, { immediate: true });

/** 暴露给父级：课程树增删改后刷新版本列表 */
defineExpose({ reload: loadLesson });

/** 操作成功后统一刷新：版本列表 + 通知父级刷新课程树（在线标等） */
const afterAction = () => {
  loadLesson();
  emit("changed");
};

/* ---------------- 新建/编辑内容弹窗 ---------------- */

const contentDialogVisible = ref(false);
const contentDialogMode = ref<"create" | "edit">("create");
const editingVersion = ref<VersionDetail | null>(null);

const openCreateVersion = () => {
  contentDialogMode.value = "create";
  editingVersion.value = null;
  contentDialogVisible.value = true;
};

const openEditVersion = (version: VersionDetail) => {
  contentDialogMode.value = "edit";
  editingVersion.value = version;
  contentDialogVisible.value = true;
};

/* ---------------- 预览弹窗 ---------------- */

const previewVisible = ref(false);
const previewVersionId = ref("");
const previewVersionNo = ref<number | undefined>(undefined);

const openPreview = (version: VersionDetail) => {
  previewVersionId.value = version.id;
  previewVersionNo.value = version.version;
  previewVisible.value = true;
};

/* ---------------- 送审（422 时弹窗展示 issues 清单） ---------------- */

const issueText = (issue: ValidationIssue): string =>
  typeof issue === "string" ? issue : JSON.stringify(issue);

const handleSubmit = async (version: VersionDetail) => {
  try {
    await submitVersionApi(version.id);
    message(`v${version.version} 已送审`, { type: "success" });
    afterAction();
  } catch (error: any) {
    if (error?.response?.status === 422) {
      const issues: ValidationIssue[] = error.response?.data?.issues ?? [];
      ElMessageBox({
        title: "送审失败：协议校验未通过",
        type: "error",
        confirmButtonText: "知道了",
        message: h("div", [
          h("p", error?.message ?? "课程协议校验失败"),
          issues.length > 0
            ? h(
                "ul",
                { style: "padding-left:18px;margin:8px 0 0;list-style:disc" },
                issues.map(issue => h("li", issueText(issue)))
              )
            : null
        ])
      });
    } else {
      message(error?.message ?? "送审失败", { type: "error" });
    }
  }
};

/* ---------------- 打回 ---------------- */

const rejectDialogVisible = ref(false);
const rejectNote = ref("");
const rejecting = ref(false);
const rejectTarget = ref<VersionDetail | null>(null);

const openReject = (version: VersionDetail) => {
  rejectTarget.value = version;
  rejectNote.value = "";
  rejectDialogVisible.value = true;
};

const handleReject = async () => {
  if (!rejectTarget.value) return;
  if (rejectNote.value.length > 500) {
    message("打回备注不能超过 500 字", { type: "warning" });
    return;
  }
  rejecting.value = true;
  try {
    await rejectVersionApi(
      rejectTarget.value.id,
      rejectNote.value || undefined
    );
    message(`v${rejectTarget.value.version} 已打回`, { type: "success" });
    rejectDialogVisible.value = false;
    afterAction();
  } catch (error: any) {
    message(error?.message ?? "打回失败", { type: "error" });
  } finally {
    rejecting.value = false;
  }
};

/* ---------------- 发布（二次确认） ---------------- */

const handlePublish = async (version: VersionDetail) => {
  try {
    await ElMessageBox.confirm(
      `确定发布 v${version.version} 吗？发布后当前在线版本将自动归档。`,
      "发布确认",
      { type: "warning", confirmButtonText: "发布", cancelButtonText: "取消" }
    );
  } catch {
    return; // 用户取消
  }
  try {
    await publishVersionApi(version.id);
    message(`v${version.version} 已发布`, { type: "success" });
    afterAction();
  } catch (error: any) {
    message(error?.message ?? "发布失败", { type: "error" });
  }
};

/* ---------------- 回滚（二次确认） ---------------- */

const handleRollback = async (version: VersionDetail) => {
  try {
    await ElMessageBox.confirm(
      `确定回滚到 v${version.version} 吗？当前在线版本将自动归档。`,
      "回滚确认",
      {
        type: "warning",
        confirmButtonText: "回滚到此版本",
        cancelButtonText: "取消"
      }
    );
  } catch {
    return; // 用户取消
  }
  try {
    await rollbackLessonApi(props.lessonId, version.id);
    message(`已回滚到 v${version.version}`, { type: "success" });
    afterAction();
  } catch (error: any) {
    message(error?.message ?? "回滚失败", { type: "error" });
  }
};
</script>

<template>
  <div v-loading="loading" class="version-panel">
    <template v-if="lesson">
      <div class="panel-header">
        <div>
          <span class="lesson-title">{{ lesson.title }}</span>
          <span class="lesson-meta">
            {{ lesson.ageBand }} · {{ lesson.estimatedMin }} 分钟
          </span>
        </div>
        <el-button type="primary" @click="openCreateVersion">
          新建版本
        </el-button>
      </div>

      <el-table :data="lesson.versions" border stripe>
        <el-table-column label="版本" width="110">
          <template #default="{ row }">
            <span>v{{ row.version }}</span>
            <el-tag
              v-if="row.id === lesson.publishedVersionId"
              type="success"
              size="small"
              class="ml-1"
            >
              在线
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag
              :type="statusMeta[row.status as VersionDetail['status']].type"
            >
              {{ statusMeta[row.status as VersionDetail["status"]].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建人" min-width="90">
          <template #default="{ row }">{{ row.createdBy ?? "—" }}</template>
        </el-table-column>
        <el-table-column label="审核备注" min-width="120">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.reviewNote"
              :content="row.reviewNote"
              placement="top"
            >
              <span class="note-cell">{{ row.reviewNote }}</span>
            </el-tooltip>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="140">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="发布时间" width="140">
          <template #default="{ row }">{{ fmtTime(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'DRAFT'">
              <el-button link type="primary" @click="openEditVersion(row)">
                编辑内容
              </el-button>
              <el-button link type="warning" @click="handleSubmit(row)">
                送审
              </el-button>
              <el-button link @click="openPreview(row)">预览</el-button>
            </template>
            <template v-else-if="row.status === 'REVIEWING'">
              <el-button link type="danger" @click="openReject(row)">
                打回
              </el-button>
              <el-button link type="success" @click="handlePublish(row)">
                发布
              </el-button>
              <el-button link @click="openPreview(row)">预览</el-button>
            </template>
            <template v-else>
              <el-button link @click="openPreview(row)">预览</el-button>
              <el-button link type="warning" @click="handleRollback(row)">
                回滚到此版本
              </el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>暂无版本，点击右上角「新建版本」创建</template>
      </el-table>
    </template>

    <el-empty v-else description="请选择左侧课程查看版本" />

    <!-- 新建/编辑版本内容 -->
    <VersionContentDialog
      v-model="contentDialogVisible"
      :mode="contentDialogMode"
      :lesson-id="lessonId"
      :version="editingVersion"
      @success="afterAction"
    />

    <!-- 版本预览 -->
    <PreviewDialog
      v-model="previewVisible"
      :version-id="previewVersionId"
      :version-no="previewVersionNo"
    />

    <!-- 打回备注 -->
    <el-dialog
      v-model="rejectDialogVisible"
      :title="`打回 v${rejectTarget?.version ?? ''}`"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-input
        v-model="rejectNote"
        type="textarea"
        :rows="4"
        maxlength="500"
        show-word-limit
        placeholder="打回原因（可选，≤500 字）"
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejecting" @click="handleReject">
          确认打回
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.version-panel {
  min-height: 300px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.lesson-title {
  margin-right: 8px;
  font-size: 16px;
  font-weight: 600;
}

.lesson-meta {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.note-cell {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}
</style>
