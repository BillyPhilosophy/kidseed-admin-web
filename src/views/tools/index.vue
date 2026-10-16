<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { message } from "@/utils/message";
import type {
  AuditionResult,
  LlmPingResult,
  SoundscapeResult,
  TtsVoiceInfo,
  TtsVoicesResult
} from "@/api/admin";
import {
  getTtsVoicesApi,
  llmPingApi,
  ttsAuditionApi,
  ttsSoundscapeApi
} from "@/api/admin";

defineOptions({ name: "ToolsIndex" });

/** 工具箱：TTS 语音试听 + 场景声生成 + LLM 连通性自检 */

/* ---------------- 音色目录 ---------------- */

/** 音色目录（进入页面时拉取；失败时页面降级为错误提示，不白屏） */
const catalog = ref<TtsVoicesResult | null>(null);
const catalogLoading = ref(false);
/** 目录接口不可达时的错误信息（非空即降级态） */
const catalogError = ref("");

const loadVoices = async () => {
  catalogLoading.value = true;
  catalogError.value = "";
  try {
    const res = await getTtsVoicesApi();
    catalog.value = res;
    // 默认选中第一个主要角色，其次目录第一个音色
    const firstPrimary = res.voices.find(v => v.primary);
    ttsForm.voice = (firstPrimary ?? res.voices[0])?.id ?? "";
  } catch (error: any) {
    catalog.value = null;
    catalogError.value = error?.message ?? "音色目录加载失败，请稍后重试";
    message(catalogError.value, { type: "error" });
  } finally {
    catalogLoading.value = false;
  }
};

onMounted(loadVoices);

/** 主要角色（primary=true，下拉置顶分组） */
const primaryVoices = computed(
  () => catalog.value?.voices.filter(v => v.primary) ?? []
);

const selectedVoice = computed<TtsVoiceInfo | null>(() => {
  if (!catalog.value || !ttsForm.voice) return null;
  return catalog.value.voices.find(v => v.id === ttsForm.voice) ?? null;
});

/** 仅 qwen-audio-3.1-tts-flash 引擎支持 instruction 情感/语气指令 */
const showInstruction = computed(
  () => selectedVoice.value?.engine === "qwen-audio-3.1-tts-flash"
);

const genderLabel = (gender: string) =>
  ({ female: "女", male: "男" })[gender] ?? gender;

const ageLabel = (age: string) =>
  ({ adult: "成人", child: "儿童", senior: "年长" })[age] ?? age;

/* ---------------- TTS 语音试听 ---------------- */

const ttsForm = reactive({
  text: "",
  voice: "",
  rate: -15,
  instruction: ""
});

const ttsLoading = ref(false);
const auditionResult = ref<AuditionResult | null>(null);

const handleAudition = async () => {
  const text = ttsForm.text.trim();
  if (!text) {
    message("请输入试听文本", { type: "warning" });
    return;
  }
  if (text.length > 30) {
    message("试听文本不能超过 30 字", { type: "warning" });
    return;
  }
  if (!ttsForm.voice) {
    message("请选择音色", { type: "warning" });
    return;
  }
  ttsLoading.value = true;
  auditionResult.value = null;
  try {
    const instruction = ttsForm.instruction.trim();
    auditionResult.value = await ttsAuditionApi({
      text,
      voice: ttsForm.voice,
      rate: ttsForm.rate,
      // 仅支持 instruction 的引擎才携带该字段
      ...(showInstruction.value && instruction ? { instruction } : {})
    });
  } catch (error: any) {
    // 400 合成失败等：error.message 已是后端中文提示
    message(error?.message ?? "合成失败", { type: "error" });
  } finally {
    ttsLoading.value = false;
  }
};

/* ---------------- 场景声生成 ---------------- */

const soundscapePrompt = ref("");
const soundscapeLoading = ref(false);
const soundscapeResult = ref<SoundscapeResult | null>(null);

/** prompt 上限：优先用接口元信息，兜底 3000 */
const maxPromptChars = computed(
  () => catalog.value?.soundscape.maxPromptChars ?? 3000
);
/** 单次时长上限：优先用接口元信息，兜底 120 */
const maxSeconds = computed(() => catalog.value?.soundscape.maxSeconds ?? 120);

const handleSoundscape = async () => {
  const prompt = soundscapePrompt.value.trim();
  if (!prompt) {
    message("请输入场景描述", { type: "warning" });
    return;
  }
  if (prompt.length > maxPromptChars.value) {
    message(`场景描述不能超过 ${maxPromptChars.value} 字`, { type: "warning" });
    return;
  }
  soundscapeLoading.value = true;
  soundscapeResult.value = null;
  try {
    // 生成耗时 15~30 秒，该请求超时已在 api 层放宽到 90s
    soundscapeResult.value = await ttsSoundscapeApi({ prompt });
  } catch (error: any) {
    message(error?.message ?? "场景声生成失败", { type: "error" });
  } finally {
    soundscapeLoading.value = false;
  }
};

/* ---------------- LLM 自检 ---------------- */

const llmLoading = ref(false);
const llmResult = ref<LlmPingResult | null>(null);

const handleLlmPing = async () => {
  llmLoading.value = true;
  llmResult.value = null;
  try {
    // 该接口永远 200，ok/detail 即诊断结果
    llmResult.value = await llmPingApi();
  } catch (error: any) {
    // 兜底：网络层异常也按失败展示
    llmResult.value = { ok: false, detail: error?.message ?? "请求失败" };
  } finally {
    llmLoading.value = false;
  }
};

/* ---------------- 展示辅助 ---------------- */

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

/** 角色目录表格：主要角色行高亮 */
const voiceRowClassName = ({ row }: { row: TtsVoiceInfo }) =>
  row.primary ? "primary-voice-row" : "";
</script>

<template>
  <div class="tools-page p-4">
    <el-row :gutter="16">
      <!-- TTS 语音试听 -->
      <el-col :xs="24" :lg="12">
        <el-card v-loading="catalogLoading" shadow="never">
          <template #header>TTS 语音试听</template>

          <!-- 目录加载失败：降级为错误提示 + 重试，不白屏 -->
          <el-alert
            v-if="catalogError"
            type="error"
            :closable="false"
            title="音色目录加载失败"
            :description="`${catalogError}（接口：GET /v1/admin/tools/tts/voices）`"
          >
            <el-button class="mt-2" size="small" @click="loadVoices">
              重试
            </el-button>
          </el-alert>

          <template v-else-if="catalog">
            <el-form label-width="90px">
              <el-form-item label="音色">
                <el-select
                  v-model="ttsForm.voice"
                  class="w-full"
                  placeholder="选择音色"
                >
                  <el-option-group v-if="primaryVoices.length" label="主要角色">
                    <el-option
                      v-for="v in primaryVoices"
                      :key="v.id"
                      :label="`${v.name}（${v.qwenVoice}）`"
                      :value="v.id"
                    >
                      <div class="voice-option">
                        <span>{{ v.name }}（{{ v.qwenVoice }}）</span>
                        <el-tag size="small" effect="plain" type="warning">
                          {{ v.engine }}
                        </el-tag>
                      </div>
                    </el-option>
                  </el-option-group>
                  <el-option-group label="全部音色">
                    <el-option
                      v-for="v in catalog.voices"
                      :key="v.id"
                      :label="`${v.name}（${v.qwenVoice}）`"
                      :value="v.id"
                    >
                      <div class="voice-option">
                        <span>{{ v.name }}（{{ v.qwenVoice }}）</span>
                        <el-tag size="small" effect="plain">
                          {{ v.engine }}
                        </el-tag>
                      </div>
                    </el-option>
                  </el-option-group>
                </el-select>
              </el-form-item>

              <!-- 选中音色的角色信息 -->
              <el-form-item v-if="selectedVoice" label="角色信息">
                <div class="voice-detail">
                  <div class="voice-desc">{{ selectedVoice.description }}</div>
                  <div class="voice-tags">
                    <el-tag size="small" effect="plain">
                      {{ genderLabel(selectedVoice.gender) }} ·
                      {{ ageLabel(selectedVoice.age) }}
                    </el-tag>
                    <el-tag
                      v-for="lang in selectedVoice.languages"
                      :key="lang"
                      size="small"
                      effect="plain"
                      type="success"
                    >
                      {{ lang }}
                    </el-tag>
                    <el-tag
                      v-for="tag in selectedVoice.tags"
                      :key="tag"
                      size="small"
                      effect="plain"
                      type="info"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </div>
              </el-form-item>

              <el-form-item label="试听文本">
                <el-input
                  v-model="ttsForm.text"
                  type="textarea"
                  :rows="3"
                  maxlength="30"
                  show-word-limit
                  placeholder="1~30 字"
                />
              </el-form-item>

              <!-- 仅 qwen-audio-3.1-tts-flash 引擎显示情感/语气指令 -->
              <el-form-item v-if="showInstruction" label="情感指令">
                <el-input
                  v-model="ttsForm.instruction"
                  maxlength="200"
                  show-word-limit
                  :placeholder="
                    selectedVoice?.instructionHint ||
                    '开心地 / 温柔地 / 慢速清晰'
                  "
                />
              </el-form-item>

              <el-form-item :label="`语速（${ttsForm.rate}）`">
                <el-slider
                  v-model="ttsForm.rate"
                  :min="-50"
                  :max="50"
                  :step="1"
                  show-input
                />
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :loading="ttsLoading"
                  @click="handleAudition"
                >
                  {{ auditionResult ? "重新生成" : "合成试听" }}
                </el-button>
              </el-form-item>
            </el-form>

            <div v-if="auditionResult" class="audio-result">
              <audio
                :src="auditionResult.url"
                controls
                autoplay
                class="w-full"
              />
              <div class="audio-meta">
                <span>{{ formatBytes(auditionResult.bytes) }}</span>
                <span v-if="auditionResult.contentType">
                  · {{ auditionResult.contentType }}
                </span>
                <span>· 链接 {{ auditionResult.expiresInDays }} 天内有效</span>
              </div>
              <div class="audio-url">{{ auditionResult.url }}</div>
            </div>
          </template>
        </el-card>
      </el-col>

      <!-- 场景声 + LLM 自检 -->
      <el-col :xs="24" :lg="12">
        <div class="right-stack">
          <el-card shadow="never">
            <template #header>场景声</template>
            <el-form label-position="top">
              <el-form-item label="场景描述">
                <el-input
                  v-model="soundscapePrompt"
                  type="textarea"
                  :rows="4"
                  :maxlength="maxPromptChars"
                  show-word-limit
                  placeholder="森林清晨的环境音：鸟儿清脆鸣叫，微风拂过树叶，远处有溪流声。纯环境音，无人声。时长约10秒。"
                />
              </el-form-item>
              <el-alert
                class="mb-3"
                type="info"
                :closable="false"
                :title="`时长在描述里写，如“时长约10秒”；单次最长${maxSeconds}秒；生成约15-30秒`"
              />
              <el-button
                type="primary"
                :loading="soundscapeLoading"
                loading-text="生成中（约15-30秒）"
                @click="handleSoundscape"
              >
                生成场景声
              </el-button>
            </el-form>

            <div v-if="soundscapeResult" class="audio-result">
              <audio
                :src="soundscapeResult.url"
                controls
                autoplay
                class="w-full"
              />
              <div class="audio-meta">
                <span>{{ formatBytes(soundscapeResult.bytes) }}</span>
                <span
                  >· 链接 {{ soundscapeResult.expiresInDays }} 天内有效</span
                >
              </div>
              <div class="audio-url">{{ soundscapeResult.url }}</div>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header>LLM 自检</template>
            <el-button
              type="primary"
              :loading="llmLoading"
              @click="handleLlmPing"
            >
              测试连通性
            </el-button>
            <div v-if="llmResult" class="mt-4">
              <el-alert
                :type="llmResult.ok ? 'success' : 'error'"
                :closable="false"
                :title="
                  llmResult.ok
                    ? `连接正常：${llmResult.detail}`
                    : llmResult.detail
                "
              />
            </div>
          </el-card>
        </div>
      </el-col>
    </el-row>

    <!-- 角色目录（只读，给开发/运营看 AI 管线可用角色） -->
    <el-row class="mt-4">
      <el-col :span="24">
        <el-card shadow="never">
          <el-collapse v-if="catalog">
            <el-collapse-item name="voice-catalog">
              <template #title>
                角色目录（{{ catalog.voices.length }} 个音色，主要角色
                {{ catalog.primaryIds.length }} 个）
              </template>
              <el-table
                :data="catalog.voices"
                :row-class-name="voiceRowClassName"
              >
                <el-table-column prop="id" label="角色 ID" min-width="130" />
                <el-table-column label="名称" min-width="110">
                  <template #default="{ row }: { row: TtsVoiceInfo }">
                    {{ row.name }}
                    <el-tag
                      v-if="row.primary"
                      class="ml-1"
                      size="small"
                      type="warning"
                      effect="plain"
                    >
                      主要
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="engine" label="引擎" min-width="180" />
                <el-table-column label="性别/年龄" width="100">
                  <template #default="{ row }: { row: TtsVoiceInfo }">
                    {{ genderLabel(row.gender) }} / {{ ageLabel(row.age) }}
                  </template>
                </el-table-column>
                <el-table-column label="语言" width="90">
                  <template #default="{ row }: { row: TtsVoiceInfo }">
                    {{ row.languages.join("、") }}
                  </template>
                </el-table-column>
                <el-table-column label="标签" min-width="140">
                  <template #default="{ row }: { row: TtsVoiceInfo }">
                    <el-tag
                      v-for="tag in row.tags"
                      :key="tag"
                      class="mr-1"
                      size="small"
                      effect="plain"
                      type="info"
                    >
                      {{ tag }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="description"
                  label="描述"
                  min-width="220"
                  show-overflow-tooltip
                />
              </el-table>
            </el-collapse-item>
          </el-collapse>
          <el-alert
            v-else
            type="info"
            :closable="false"
            title="音色目录不可用，角色目录无法展示"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.right-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voice-option {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.voice-detail {
  width: 100%;
}

.voice-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.voice-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.audio-result {
  margin-top: 8px;
}

.audio-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.audio-url {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* 角色目录：主要角色行高亮 */
:deep(.primary-voice-row) {
  background-color: var(--el-color-warning-light-9);
}
</style>
