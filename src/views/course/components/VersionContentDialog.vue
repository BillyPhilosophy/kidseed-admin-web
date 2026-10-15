<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "@/utils/message";
import type { ValidationIssue, VersionDetail } from "@/api/admin";
import {
  createVersionApi,
  getVersionApi,
  updateVersionContentApi
} from "@/api/admin";

/** 版本内容弹窗：create=新建版本（content 为空），edit=编辑 DRAFT 版本内容（先拉取详情填入） */
const props = defineProps<{
  modelValue: boolean;
  /** create=新建版本；edit=编辑草稿内容 */
  mode: "create" | "edit";
  /** 所属课程 id（create 模式必填） */
  lessonId: string;
  /** 编辑目标版本（edit 模式必填） */
  version: VersionDetail | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  /** 保存成功，通知父级刷新版本列表与课程树 */
  success: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
});

const dialogTitle = computed(() =>
  props.mode === "create"
    ? "新建版本"
    : `编辑版本内容（v${props.version?.version ?? ""}）`
);

const loading = ref(false);
const submitting = ref(false);
/** 课程协议 JSON 文本 */
const jsonText = ref("");
/** 422 协议校验失败时的问题清单（展示在弹窗内，不关闭弹窗） */
const issues = ref<ValidationIssue[]>([]);

/** 打开弹窗：edit 模式先拉取版本详情，把 content 格式化填入 */
watch(visible, async v => {
  if (!v) return;
  issues.value = [];
  jsonText.value = "";
  if (props.mode === "edit" && props.version) {
    loading.value = true;
    try {
      const detail = await getVersionApi(props.version.id);
      jsonText.value = JSON.stringify(detail.content ?? {}, null, 2);
    } catch (error: any) {
      message(error?.message ?? "获取版本详情失败", { type: "error" });
      visible.value = false;
    } finally {
      loading.value = false;
    }
  }
});

/** 格式化按钮：非法 JSON 只提示、不阻断 */
const formatJson = () => {
  try {
    jsonText.value = JSON.stringify(JSON.parse(jsonText.value), null, 2);
    message("已格式化", { type: "success" });
  } catch {
    message("JSON 格式不正确，无法格式化", { type: "warning" });
  }
};

/** 单条 issue 转可读文本（结构以后端实际为准，兼容字符串与对象） */
const issueText = (issue: ValidationIssue): string =>
  typeof issue === "string" ? issue : JSON.stringify(issue);

const handleSubmit = async () => {
  let content: unknown;
  try {
    content = JSON.parse(jsonText.value);
  } catch {
    message("JSON 格式不正确，请检查后再提交", { type: "error" });
    return;
  }
  submitting.value = true;
  issues.value = [];
  try {
    if (props.mode === "create") {
      await createVersionApi(props.lessonId, content);
      message("版本已创建（草稿）", { type: "success" });
    } else if (props.version) {
      await updateVersionContentApi(props.version.id, content);
      message("版本内容已保存", { type: "success" });
    }
    visible.value = false;
    emit("success");
  } catch (error: any) {
    // 422 协议校验失败：把 issues 清单展示在弹窗内；409 状态不可编辑等直接弹提示
    if (error?.response?.status === 422) {
      issues.value = error.response?.data?.issues ?? [];
    }
    message(error?.message ?? "操作失败", { type: "error" });
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="760px"
    top="6vh"
    :close-on-click-modal="false"
  >
    <div v-loading="loading">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-gray-500 text-sm">
          课程协议 JSON（schemaVersion / meta / assets / steps / completion
          五段结构）
        </span>
        <el-button size="small" @click="formatJson">格式化</el-button>
      </div>
      <el-input
        v-model="jsonText"
        type="textarea"
        :rows="18"
        spellcheck="false"
        placeholder='{
  "schemaVersion": 1,
  "meta": {},
  "assets": {},
  "steps": [],
  "completion": {}
}'
      />
      <el-alert
        v-if="issues.length > 0"
        class="mt-3"
        type="error"
        :closable="false"
        title="协议校验失败，请根据以下问题修改："
      >
        <ul class="issue-list">
          <li v-for="(issue, i) in issues" :key="i">{{ issueText(issue) }}</li>
        </ul>
      </el-alert>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        提交
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.issue-list {
  padding-left: 18px;
  margin: 6px 0 0;
  list-style: disc;
}

.issue-list li {
  margin-top: 4px;
  word-break: break-all;
}
</style>
