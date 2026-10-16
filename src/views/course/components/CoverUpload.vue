<script setup lang="ts">
import { computed, ref } from "vue";
import type { UploadFile, UploadInstance } from "element-plus";
import { message } from "@/utils/message";
import { buildAssetUrl, mediaPresign, uploadFileToMinio } from "@/api/upload";

/** 封面图片上传组件：v-model 绑定 MinIO 资源键（coverKey），空串 = 未设置 */
const props = defineProps<{
  /** 封面 MinIO key */
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

/** 允许的图片 MIME 类型 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** 大小上限：2MB */
const MAX_SIZE = 2 * 1024 * 1024;

const uploading = ref(false);
const selectUploadRef = ref<UploadInstance>();
const reUploadRef = ref<UploadInstance>();

/** 已有 key 时的公网访问地址（缩略图与点击预览共用） */
const previewUrl = computed(() => buildAssetUrl("image", props.modelValue));
const previewList = computed(() =>
  previewUrl.value ? [previewUrl.value] : []
);

/**
 * 选中文件：本地校验 → presign → PUT 直传 MinIO → 回写新 key
 * （`:auto-upload="false"`，el-upload 自身不发任何请求，仅作文件选择器）
 */
const handleFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw;
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    message("仅支持 JPG / PNG / WebP 格式的图片", { type: "warning" });
    return;
  }
  if (file.size > MAX_SIZE) {
    message("图片大小不能超过 2MB", { type: "warning" });
    return;
  }
  uploading.value = true;
  try {
    const presign = await mediaPresign({
      filename: file.name,
      contentType: file.type,
      kind: "image"
    });
    await uploadFileToMinio(presign, file);
    emit("update:modelValue", presign.key);
    message("封面上传成功", { type: "success" });
  } catch (error: any) {
    // presign 走 http 封装，error.message 已是后端中文提示；PUT 直传失败为「上传失败: HTTP xxx」
    message(error?.message ?? "上传失败", { type: "error" });
  } finally {
    uploading.value = false;
    // 清空 el-upload 内部文件列表（不展示 file-list，仅保持内部状态干净）
    selectUploadRef.value?.clearFiles();
    reUploadRef.value?.clearFiles();
  }
};

/** 清除封面（回写空串，父组件提交时转为 undefined） */
const handleClear = () => {
  emit("update:modelValue", "");
};
</script>

<template>
  <div v-loading="uploading" class="cover-upload">
    <!-- 已有封面：缩略图（点击预览大图）+ key + 操作按钮 -->
    <div v-if="modelValue" class="cover-has">
      <el-image
        :src="previewUrl"
        :preview-src-list="previewList"
        fit="cover"
        preview-teleported
        class="cover-thumb"
      >
        <template #error>
          <div class="thumb-error">加载失败</div>
        </template>
      </el-image>
      <div class="cover-meta">
        <div class="cover-key" :title="modelValue">{{ modelValue }}</div>
        <div class="cover-ops">
          <el-upload
            ref="reUploadRef"
            :auto-upload="false"
            :show-file-list="false"
            accept=".jpg,.jpeg,.png,.webp"
            :disabled="uploading"
            :on-change="handleFileChange"
          >
            <el-button size="small" :loading="uploading">重新上传</el-button>
          </el-upload>
          <el-button
            size="small"
            type="danger"
            plain
            :disabled="uploading"
            @click="handleClear"
          >
            清除
          </el-button>
        </div>
      </div>
    </div>

    <!-- 无封面：拖拽 / 点击选择 -->
    <el-upload
      v-else
      ref="selectUploadRef"
      drag
      :auto-upload="false"
      :show-file-list="false"
      accept=".jpg,.jpeg,.png,.webp"
      :disabled="uploading"
      :on-change="handleFileChange"
      class="cover-select"
    >
      <div class="upload-inner">
        <svg
          class="upload-icon"
          viewBox="0 0 1024 1024"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="currentColor"
            d="M544 864V672h128L512 480 352 672h128v192H320v-1.6c-5.4.7-10.8 1.6-16 1.6A240 240 0 0 1 64 624c0-123.8 93.1-223.7 212-237.4C297 234.4 396.6 160 512 160c132.6 0 240 107.4 240 240 0 8.2-.4 16.3-1.2 24.3C867.4 443.2 960 536 960 648a216.2 216.2 0 0 1-208 216c-5.2 0-10.6-.9-16-1.6V864H544z"
          />
        </svg>
        <div class="el-upload__text">拖拽图片到此处，或 <em>点击选择</em></div>
        <div class="upload-tip">支持 JPG / PNG / WebP，不超过 2MB</div>
      </div>
    </el-upload>
  </div>
</template>

<style scoped>
.cover-upload {
  width: 100%;
}

.cover-has {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.cover-thumb {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.thumb-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.cover-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.cover-key {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.cover-ops {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 抵消 el-upload 默认行高，保证两个按钮对齐 */
.cover-ops :deep(.el-upload) {
  line-height: 1;
}

.cover-select {
  width: 100%;
}

.cover-select :deep(.el-upload-dragger) {
  padding: 16px;
}

.upload-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.upload-icon {
  width: 32px;
  height: 32px;
  color: var(--el-text-color-secondary);
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
