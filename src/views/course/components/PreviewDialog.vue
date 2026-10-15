<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "@/utils/message";
import { getVersionPreviewApi } from "@/api/admin";

/** 版本预览弹窗：格式化展示 preview 接口返回的 JSON（不做可视化） */
const props = defineProps<{
  modelValue: boolean;
  /** 预览目标版本 id */
  versionId: string;
  /** 版本号（仅用于标题展示） */
  versionNo?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
});

const loading = ref(false);
const previewText = ref("");

/** 弹窗标题（带版本号） */
const dialogTitle = computed(() =>
  props.versionNo != null ? `版本预览（v${props.versionNo}）` : "版本预览"
);

watch(visible, async v => {
  if (!v || !props.versionId) return;
  loading.value = true;
  previewText.value = "";
  try {
    const preview = await getVersionPreviewApi(props.versionId);
    previewText.value = JSON.stringify(preview, null, 2);
  } catch (error: any) {
    message(error?.message ?? "获取预览失败", { type: "error" });
    visible.value = false;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="760px" top="6vh">
    <div v-loading="loading" class="preview-body">
      <pre>{{ previewText }}</pre>
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.preview-body {
  min-height: 200px;
}

.preview-body pre {
  max-height: 60vh;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
