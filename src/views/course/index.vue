<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import type { LessonNode, Track, UnitNode } from "@/api/admin";
import { deleteLessonApi, deleteUnitApi, getTreeApi } from "@/api/admin";
import { buildAssetUrl } from "@/api/upload";
import { trackLabel, trackOptions } from "./utils";
import UnitFormDialog from "./components/UnitFormDialog.vue";
import LessonFormDialog from "./components/LessonFormDialog.vue";
import VersionPanel from "./components/VersionPanel.vue";

defineOptions({ name: "CourseManage" });

/** 课程管理主页面：左侧单元/课程树，右侧选中课程的版本面板 */

const treeLoading = ref(false);
const tree = ref<UnitNode[]>([]);
/** 赛道筛选；空串 = 全部 */
const trackFilter = ref<Track | "">("");

/** 拉取课程树 */
const loadTree = async () => {
  treeLoading.value = true;
  try {
    tree.value = await getTreeApi(trackFilter.value || undefined);
  } catch (error: any) {
    message(error?.message ?? "获取课程树失败", { type: "error" });
  } finally {
    treeLoading.value = false;
  }
};

onMounted(loadTree);

/** 切换赛道筛选 */
const handleTrackChange = () => {
  loadTree();
};

/* ---------------- 树节点 ---------------- */

/** 区分单元节点与课程节点（单元有 lessons 字段） */
const isUnitNode = (data: UnitNode | LessonNode): data is UnitNode =>
  "lessons" in data;

/** 封面加载失败的 key 集合（静默隐藏缩略图，不出现破图占位） */
const hiddenCovers = reactive(new Set<string>());

/** 单元封面缩略图地址（无 key 返回空串） */
const coverUrl = (unit: UnitNode): string =>
  buildAssetUrl("image", unit.coverKey ?? "");

/** 封面加载失败：记录 key 并隐藏对应 img */
const handleCoverError = (key: string | null) => {
  if (key) hiddenCovers.add(key);
};

/** 当前选中课程 id（空串 = 未选中） */
const selectedLessonId = ref("");
const versionPanelRef = ref<InstanceType<typeof VersionPanel>>();

/** 点击树节点：点击课程节点即选中，右侧展示版本面板 */
const handleNodeClick = (data: UnitNode | LessonNode) => {
  if (!isUnitNode(data)) {
    selectedLessonId.value = data.id;
  }
};

/** 课程的当前在线版本号（publishedVersionId 对应版本） */
const onlineVersion = (lesson: LessonNode): number | null =>
  lesson.versions.find(v => v.id === lesson.publishedVersionId)?.version ??
  null;

/* ---------------- 单元弹窗与操作 ---------------- */

const unitDialogVisible = ref(false);
const editingUnit = ref<UnitNode | null>(null);

const openCreateUnit = () => {
  editingUnit.value = null;
  unitDialogVisible.value = true;
};

const openEditUnit = (unit: UnitNode) => {
  editingUnit.value = unit;
  unitDialogVisible.value = true;
};

const handleDeleteUnit = async (unit: UnitNode) => {
  try {
    await ElMessageBox.confirm(
      `确定删除单元「${unit.title}」吗？单元下还有课程时会被拒绝。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return; // 用户取消
  }
  try {
    await deleteUnitApi(unit.id);
    message("单元已删除", { type: "success" });
    loadTree();
  } catch (error: any) {
    // 409 单元下还有课程：error.message 已是后端中文提示
    message(error?.message ?? "删除失败", { type: "error" });
  }
};

/* ---------------- 课程弹窗与操作 ---------------- */

const lessonDialogVisible = ref(false);
const editingLesson = ref<LessonNode | null>(null);
const lessonUnitId = ref("");
const lessonUnitTitle = ref("");

const openCreateLesson = (unit: UnitNode) => {
  editingLesson.value = null;
  lessonUnitId.value = unit.id;
  lessonUnitTitle.value = unit.title;
  lessonDialogVisible.value = true;
};

const openEditLesson = (lesson: LessonNode) => {
  editingLesson.value = lesson;
  lessonUnitId.value = lesson.unitId;
  lessonUnitTitle.value = "";
  lessonDialogVisible.value = true;
};

const handleDeleteLesson = async (lesson: LessonNode) => {
  try {
    await ElMessageBox.confirm(
      `确定删除课程「${lesson.title}」吗？已有版本内容的课程会被拒绝。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return; // 用户取消
  }
  try {
    await deleteLessonApi(lesson.id);
    message("课程已删除", { type: "success" });
    if (selectedLessonId.value === lesson.id) selectedLessonId.value = "";
    loadTree();
  } catch (error: any) {
    // 409 已有版本内容：error.message 已是后端中文提示
    message(error?.message ?? "删除失败", { type: "error" });
  }
};

/** 单元/课程表单保存成功后刷新树与版本面板 */
const handleFormSuccess = () => {
  loadTree();
  versionPanelRef.value?.reload();
};

/** 版本面板操作后刷新树（在线标、版本数等会变化） */
const handleVersionChanged = () => {
  loadTree();
};
</script>

<template>
  <div class="course-page p-4">
    <!-- 顶部工具栏 -->
    <el-card shadow="never" class="mb-4">
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="toolbar-label">赛道：</span>
          <el-radio-group v-model="trackFilter" @change="handleTrackChange">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button
              v-for="opt in trackOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
          <el-button class="ml-3" :loading="treeLoading" @click="loadTree">
            刷新
          </el-button>
        </div>
        <el-button type="primary" @click="openCreateUnit"> 新建单元 </el-button>
      </div>
    </el-card>

    <el-row :gutter="16">
      <!-- 左侧：单元/课程树 -->
      <el-col :xs="24" :md="9">
        <el-card v-loading="treeLoading" shadow="never">
          <template #header>课程目录</template>
          <el-tree
            :data="tree"
            node-key="id"
            :props="{ label: 'title', children: 'lessons' }"
            default-expand-all
            highlight-current
            :expand-on-click-node="false"
            @node-click="handleNodeClick"
          >
            <template #default="{ data }">
              <div class="tree-node">
                <template v-if="isUnitNode(data)">
                  <span class="node-text">
                    <img
                      v-if="data.coverKey && !hiddenCovers.has(data.coverKey)"
                      :src="coverUrl(data)"
                      class="unit-cover"
                      alt=""
                      @error="handleCoverError(data.coverKey)"
                    />
                    <el-tag size="small" class="mr-1">
                      {{ trackLabel(data.track) }}
                    </el-tag>
                    {{ data.order }}. {{ data.title }}
                  </span>
                  <span class="node-ops">
                    <el-button
                      link
                      type="primary"
                      @click.stop="openEditUnit(data)"
                    >
                      编辑
                    </el-button>
                    <el-button
                      link
                      type="danger"
                      @click.stop="handleDeleteUnit(data)"
                    >
                      删除
                    </el-button>
                    <el-button
                      link
                      type="success"
                      @click.stop="openCreateLesson(data)"
                    >
                      新建课程
                    </el-button>
                  </span>
                </template>
                <template v-else>
                  <span class="node-text">
                    {{ data.order }}. {{ data.title }}
                    <el-tag size="small" type="info" class="ml-1">
                      {{ data.ageBand }}
                    </el-tag>
                    <span class="lesson-min">{{ data.estimatedMin }}分钟</span>
                    <el-tag
                      v-if="onlineVersion(data) != null"
                      size="small"
                      type="success"
                      class="ml-1"
                    >
                      v{{ onlineVersion(data) }} 在线
                    </el-tag>
                  </span>
                  <span class="node-ops">
                    <el-button
                      link
                      type="primary"
                      @click.stop="openEditLesson(data)"
                    >
                      编辑
                    </el-button>
                    <el-button
                      link
                      type="danger"
                      @click.stop="handleDeleteLesson(data)"
                    >
                      删除
                    </el-button>
                    <el-button
                      link
                      type="warning"
                      @click.stop="selectedLessonId = data.id"
                    >
                      管理版本
                    </el-button>
                  </span>
                </template>
              </div>
            </template>
          </el-tree>
          <el-empty
            v-if="!treeLoading && tree.length === 0"
            description="暂无单元，点击右上角「新建单元」创建"
          />
        </el-card>
      </el-col>

      <!-- 右侧：版本面板 -->
      <el-col :xs="24" :md="15">
        <el-card shadow="never">
          <template #header>版本管理</template>
          <VersionPanel
            ref="versionPanelRef"
            :lesson-id="selectedLessonId"
            @changed="handleVersionChanged"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 单元新建/编辑 -->
    <UnitFormDialog
      v-model="unitDialogVisible"
      :unit="editingUnit"
      :default-track="trackFilter"
      @success="handleFormSuccess"
    />

    <!-- 课程新建/编辑 -->
    <LessonFormDialog
      v-model="lessonDialogVisible"
      :lesson="editingLesson"
      :unit-id="lessonUnitId"
      :unit-title="lessonUnitTitle"
      @success="handleFormSuccess"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.toolbar-label {
  margin-right: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.tree-node {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
  overflow: hidden;
}

.node-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-cover {
  width: 24px;
  height: 24px;
  margin-right: 6px;
  vertical-align: middle;
  object-fit: cover;
  border-radius: 4px;
}

.lesson-min {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.node-ops {
  flex-shrink: 0;
  margin-left: 8px;
}

:deep(.el-tree-node__content) {
  height: 36px;
}
</style>
