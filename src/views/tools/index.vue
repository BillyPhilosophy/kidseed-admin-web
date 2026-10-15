<script setup lang="ts">
import { reactive, ref } from "vue";
import { message } from "@/utils/message";
import type { LlmPingResult, TtsVoice } from "@/api/admin";
import { llmPingApi, ttsAuditionApi } from "@/api/admin";

defineOptions({ name: "ToolsIndex" });

/** 工具箱：TTS 试听 + LLM 连通性自检 */

/* ---------------- TTS 试听 ---------------- */

const ttsForm = reactive({
  text: "",
  voice: "zh-CN-XiaoxiaoNeural" as TtsVoice,
  rate: -15
});

const ttsLoading = ref(false);
/** 试听音频 URL（拿不到时把完整响应展示出来方便调试） */
const audioUrl = ref("");
/** 拿不到 URL 时的完整响应 JSON 文本 */
const rawResult = ref("");

const voiceOptions: Array<{ label: string; value: TtsVoice }> = [
  { label: "中文·晓晓", value: "zh-CN-XiaoxiaoNeural" },
  { label: "英文童声·Ana", value: "en-US-AnaNeural" }
];

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
  ttsLoading.value = true;
  audioUrl.value = "";
  rawResult.value = "";
  try {
    const res = await ttsAuditionApi({
      text,
      voice: ttsForm.voice,
      rate: ttsForm.rate
    });
    // 字段名以后端实际为准，兼容 url / audioUrl / data.url
    const url = res?.url ?? res?.audioUrl ?? res?.data?.url ?? "";
    if (url) {
      audioUrl.value = url;
    } else {
      rawResult.value = JSON.stringify(res, null, 2);
      message("响应中未找到音频 URL，已展示完整响应供调试", {
        type: "warning"
      });
    }
  } catch (error: any) {
    // 400 合成失败等：error.message 已是后端中文提示
    message(error?.message ?? "合成失败", { type: "error" });
  } finally {
    ttsLoading.value = false;
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
</script>

<template>
  <div class="tools-page p-4">
    <el-row :gutter="16">
      <!-- TTS 试听 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>TTS 试听</template>
          <el-form label-width="90px">
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
            <el-form-item label="发音人">
              <el-radio-group v-model="ttsForm.voice">
                <el-radio
                  v-for="opt in voiceOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </el-radio>
              </el-radio-group>
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
                合成试听
              </el-button>
            </el-form-item>
          </el-form>

          <div v-if="audioUrl" class="audio-result">
            <audio :src="audioUrl" controls autoplay class="w-full" />
            <div class="audio-url">{{ audioUrl }}</div>
          </div>
          <el-alert
            v-if="rawResult"
            class="mt-3"
            type="warning"
            :closable="false"
            title="完整响应（未解析到音频 URL）："
          >
            <pre class="raw-json">{{ rawResult }}</pre>
          </el-alert>
        </el-card>
      </el-col>

      <!-- LLM 自检 -->
      <el-col :xs="24" :md="12">
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
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.audio-result {
  margin-top: 8px;
}

.audio-url {
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.raw-json {
  max-height: 240px;
  margin: 6px 0 0;
  overflow: auto;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
