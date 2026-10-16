<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { message } from "@/utils/message";
import type { Track, UnitNode } from "@/api/admin";
import { createUnitApi, updateUnitApi } from "@/api/admin";
import { trackOptions } from "../utils";
import CoverUpload from "./CoverUpload.vue";

/** 单元新建/编辑弹窗：unit 为 null 时是新建，否则是编辑 */
const props = defineProps<{
  modelValue: boolean;
  /** 编辑目标；null 表示新建 */
  unit: UnitNode | null;
  /** 新建时默认选中的赛道（跟随当前筛选器） */
  defaultTrack?: Track | "";
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  /** 保存成功，通知父级刷新课程树 */
  success: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
});

const isEdit = computed(() => props.unit !== null);
const title = computed(() => (isEdit.value ? "编辑单元" : "新建单元"));

const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive({
  track: "" as Track | "",
  title: "",
  order: 0,
  coverKey: ""
});

const rules: FormRules = {
  track: [{ required: true, message: "请选择赛道", trigger: "change" }],
  title: [
    { required: true, message: "请输入单元标题", trigger: "blur" },
    { max: 50, message: "标题不能超过 50 字", trigger: "blur" }
  ],
  order: [
    { required: true, message: "请输入排序号", trigger: "blur" },
    {
      type: "integer",
      min: 0,
      message: "排序号须为 ≥0 的整数",
      trigger: "blur"
    }
  ]
};

/** 打开弹窗时按新建/编辑回填表单 */
watch(visible, v => {
  if (!v) return;
  if (props.unit) {
    form.track = props.unit.track;
    form.title = props.unit.title;
    form.order = props.unit.order;
    form.coverKey = props.unit.coverKey ?? "";
  } else {
    form.track = props.defaultTrack || "";
    form.title = "";
    form.order = 0;
    form.coverKey = "";
  }
  formRef.value?.clearValidate();
});

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate().catch(() => Promise.reject());
  submitting.value = true;
  try {
    if (isEdit.value && props.unit) {
      await updateUnitApi(props.unit.id, {
        title: form.title,
        order: form.order,
        coverKey: form.coverKey || undefined
      });
      message("单元已更新", { type: "success" });
    } else {
      await createUnitApi({
        track: form.track as Track,
        title: form.title,
        order: form.order,
        coverKey: form.coverKey || undefined
      });
      message("单元已创建", { type: "success" });
    }
    visible.value = false;
    emit("success");
  } catch (error: any) {
    // 409 排序冲突等场景：error.message 已是后端中文提示，直接弹出
    message(error?.message ?? "操作失败", { type: "error" });
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="480px"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="赛道" prop="track">
        <el-select
          v-model="form.track"
          placeholder="请选择赛道"
          class="w-full"
          :disabled="isEdit"
        >
          <el-option
            v-for="opt in trackOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="标题" prop="title">
        <el-input
          v-model="form.title"
          maxlength="50"
          show-word-limit
          placeholder="单元标题，≤50 字"
        />
      </el-form-item>
      <el-form-item label="排序号" prop="order">
        <el-input-number
          v-model="form.order"
          :min="0"
          :step="1"
          step-strictly
        />
      </el-form-item>
      <el-form-item label="封面">
        <div class="cover-field">
          <CoverUpload v-model="form.coverKey" />
          <el-input
            v-model="form.coverKey"
            size="small"
            placeholder="也可直接粘贴已有 MinIO key"
          />
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.cover-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
</style>
