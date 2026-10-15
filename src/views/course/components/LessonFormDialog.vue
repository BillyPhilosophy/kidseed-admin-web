<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { message } from "@/utils/message";
import type { LessonNode } from "@/api/admin";
import { createLessonApi, updateLessonApi } from "@/api/admin";

/** 课程新建/编辑弹窗：lesson 为 null 时是新建（需要 unitId），否则是编辑 */
const props = defineProps<{
  modelValue: boolean;
  /** 编辑目标；null 表示新建 */
  lesson: LessonNode | null;
  /** 新建时所属单元 id */
  unitId: string;
  /** 新建时所属单元标题（仅用于弹窗提示） */
  unitTitle?: string;
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

const isEdit = computed(() => props.lesson !== null);
const dialogTitle = computed(() =>
  isEdit.value
    ? "编辑课程"
    : `新建课程${props.unitTitle ? `（${props.unitTitle}）` : ""}`
);

const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive({
  title: "",
  order: 0,
  ageBand: "4-5",
  estimatedMin: 8
});

const rules: FormRules = {
  title: [
    { required: true, message: "请输入课程标题", trigger: "blur" },
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
  ],
  ageBand: [{ max: 16, message: "年龄段不能超过 16 字符", trigger: "blur" }],
  estimatedMin: [
    { required: true, message: "请输入预计时长", trigger: "blur" },
    {
      type: "integer",
      min: 1,
      message: "预计时长须为 ≥1 的整数",
      trigger: "blur"
    }
  ]
};

/** 打开弹窗时按新建/编辑回填表单 */
watch(visible, v => {
  if (!v) return;
  if (props.lesson) {
    form.title = props.lesson.title;
    form.order = props.lesson.order;
    form.ageBand = props.lesson.ageBand;
    form.estimatedMin = props.lesson.estimatedMin;
  } else {
    form.title = "";
    form.order = 0;
    form.ageBand = "4-5";
    form.estimatedMin = 8;
  }
  formRef.value?.clearValidate();
});

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate().catch(() => Promise.reject());
  submitting.value = true;
  try {
    if (isEdit.value && props.lesson) {
      await updateLessonApi(props.lesson.id, {
        title: form.title,
        order: form.order,
        ageBand: form.ageBand || undefined,
        estimatedMin: form.estimatedMin
      });
      message("课程已更新", { type: "success" });
    } else {
      await createLessonApi({
        unitId: props.unitId,
        title: form.title,
        order: form.order,
        ageBand: form.ageBand || undefined,
        estimatedMin: form.estimatedMin
      });
      message("课程已创建", { type: "success" });
    }
    visible.value = false;
    emit("success");
  } catch (error: any) {
    // 404 单元不存在 / 409 排序冲突：error.message 已是后端中文提示
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
    width="480px"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="标题" prop="title">
        <el-input
          v-model="form.title"
          maxlength="50"
          show-word-limit
          placeholder="课程标题，≤50 字"
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
      <el-form-item label="年龄段" prop="ageBand">
        <el-input v-model="form.ageBand" maxlength="16" placeholder="如 4-5" />
      </el-form-item>
      <el-form-item label="预计时长" prop="estimatedMin">
        <el-input-number
          v-model="form.estimatedMin"
          :min="1"
          :step="1"
          step-strictly
        />
        <span class="ml-2 text-gray-400 text-sm">分钟</span>
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
