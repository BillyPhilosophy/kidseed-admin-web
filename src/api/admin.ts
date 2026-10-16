import { http } from "@/utils/http";
import type { UserRole } from "@/api/user";

/**
 * 管理后台业务 API 层（前缀均为 `/v1/admin`，需 ADMIN 角色，路由守卫已保证）
 * 页面只允许从这里 import，不要直接写 `http.request`
 */

/** 赛道枚举 */
export type Track = "CHINESE" | "ENGLISH" | "MATH" | "GENERAL";

/** 版本状态枚举（DRAFT --送审--> REVIEWING --发布--> PUBLISHED；打回回到 DRAFT；旧在线自动归档 ARCHIVED） */
export type VersionStatus = "DRAFT" | "REVIEWING" | "PUBLISHED" | "ARCHIVED";

/** TTS 发音人枚举 */
export type TtsVoice = "zh-CN-XiaoxiaoNeural" | "en-US-AnaNeural";

/** 版本摘要（课程树/课程详情内嵌） */
export interface VersionSummary {
  /** 版本 id（uuid） */
  id: string;
  /** 版本号（自增） */
  version: number;
  /** 版本状态 */
  status: VersionStatus;
  /** 创建时间 */
  createdAt: string;
}

/** 版本详情（`GET /lessons/:id` 内嵌，比课程树里的摘要字段更全） */
export interface VersionDetail extends VersionSummary {
  /** 创建人 */
  createdBy: string | null;
  /** 审核备注（打回原因等） */
  reviewNote: string | null;
  /** 发布时间 */
  publishedAt: string | null;
}

/** 课程节点（课程树内嵌） */
export interface LessonNode {
  /** 课程 id（uuid） */
  id: string;
  /** 所属单元 id */
  unitId: string;
  /** 课程标题 */
  title: string;
  /** 单元内排序号 */
  order: number;
  /** 年龄段 */
  ageBand: string;
  /** 预计时长（分钟） */
  estimatedMin: number;
  /** 当前在线版本 id（无则为 null） */
  publishedVersionId: string | null;
  /** 版本摘要列表（按 version 降序） */
  versions: VersionSummary[];
}

/** 单元节点（`GET /tree` 返回的数组元素） */
export interface UnitNode {
  /** 单元 id（uuid） */
  id: string;
  /** 所属赛道 */
  track: Track;
  /** 单元标题 */
  title: string;
  /** 赛道内排序号 */
  order: number;
  /** 封面 MinIO key */
  coverKey: string | null;
  /** 单元下课程列表（按 order 升序） */
  lessons: LessonNode[];
}

/** 课程详情（`GET /lessons/:id`，versions 字段更全） */
export interface LessonDetail extends Omit<LessonNode, "versions"> {
  /** 版本详情列表（按 version 降序） */
  versions: VersionDetail[];
}

/** 协议校验问题项（422 响应体里的 `issues` 数组元素，结构以后端实际为准，故保持宽松） */
export type ValidationIssue = Record<string, unknown> | string;

/** 新建单元请求参数（`POST /units`） */
export interface CreateUnitParams {
  /** 所属赛道 */
  track: Track;
  /** 单元标题（≤50 字） */
  title: string;
  /** 赛道内排序号（≥0 整数，409=被占用） */
  order: number;
  /** 封面 MinIO key（可选） */
  coverKey?: string;
}

/** 更新单元请求参数（`PATCH /units/:id`） */
export interface UpdateUnitParams {
  /** 单元标题 */
  title?: string;
  /** 排序号（409=被占用） */
  order?: number;
  /** 封面 MinIO key */
  coverKey?: string;
}

/** 新建课程请求参数（`POST /lessons`） */
export interface CreateLessonParams {
  /** 所属单元 id（uuid，404=单元不存在） */
  unitId: string;
  /** 课程标题（≤50 字） */
  title: string;
  /** 单元内排序号（≥0 整数，409=冲突） */
  order: number;
  /** 年龄段（默认 "4-5"，≤16 字符） */
  ageBand?: string;
  /** 预计时长（整数 ≥1，默认 8） */
  estimatedMin?: number;
}

/** 更新课程请求参数（`PATCH /lessons/:id`） */
export interface UpdateLessonParams {
  /** 课程标题 */
  title?: string;
  /** 排序号 */
  order?: number;
  /** 年龄段 */
  ageBand?: string;
  /** 预计时长 */
  estimatedMin?: number;
}

/** 版本完整内容（`GET /versions/:id` 返回，含完整 content JSON） */
export interface VersionContentResult extends VersionDetail {
  /** 课程协议 JSON（schemaVersion/meta/assets/steps/completion 五段结构） */
  content: unknown;
}

/** TTS 试听请求参数（`POST /tts/audition`） */
export interface AuditionParams {
  /** 试听文本（1~30 字） */
  text: string;
  /** 发音人 */
  voice: TtsVoice;
  /** 语速（-50~50 整数，默认 -15） */
  rate?: number;
}

/** TTS 试听返回（字段名以后端实际为准，兼容取 url/audioUrl/data.url） */
export interface AuditionResult {
  /** 公网试听 URL（可能字段名） */
  url?: string;
  /** 公网试听 URL（可能字段名） */
  audioUrl?: string;
  /** 嵌套返回时的包装 */
  data?: { url?: string };
  /** 其余字段原样保留，拿不到 URL 时整体展示方便调试 */
  [key: string]: unknown;
}

/** LLM 连通性自检返回（`GET /llm/ping`，永远 200） */
export interface LlmPingResult {
  /** 是否连通正常 */
  ok: boolean;
  /** 中文诊断信息 */
  detail: string;
}

/* ============================== 课程树/目录 ============================== */

/** 获取课程树（track 省略 = 全部赛道） */
export const getTreeApi = (track?: Track) => {
  return http.request<UnitNode[]>("get", "/v1/admin/tree", {
    params: track ? { track } : {}
  });
};

/** 新建单元（409=排序号被占用） */
export const createUnitApi = (data: CreateUnitParams) => {
  return http.request<UnitNode>("post", "/v1/admin/units", { data });
};

/** 更新单元（404=不存在，409=排序冲突） */
export const updateUnitApi = (id: string, data: UpdateUnitParams) => {
  return http.request<UnitNode>("patch", `/v1/admin/units/${id}`, { data });
};

/** 删除单元（409=单元下还有课程） */
export const deleteUnitApi = (id: string) => {
  return http.request<void>("delete", `/v1/admin/units/${id}`);
};

/** 新建课程（404=单元不存在，409=排序冲突） */
export const createLessonApi = (data: CreateLessonParams) => {
  return http.request<LessonNode>("post", "/v1/admin/lessons", { data });
};

/** 课程详情（versions 含 createdBy/reviewNote/publishedAt） */
export const getLessonApi = (id: string) => {
  return http.request<LessonDetail>("get", `/v1/admin/lessons/${id}`);
};

/** 更新课程 */
export const updateLessonApi = (id: string, data: UpdateLessonParams) => {
  return http.request<LessonNode>("patch", `/v1/admin/lessons/${id}`, {
    data
  });
};

/** 删除课程（409=已有版本内容） */
export const deleteLessonApi = (id: string) => {
  return http.request<void>("delete", `/v1/admin/lessons/${id}`);
};

/* ============================== 版本状态机 ============================== */

/** 新建版本（版本号自增，状态 DRAFT；422=协议校验失败，响应含 message + issues） */
export const createVersionApi = (lessonId: string, content: unknown) => {
  return http.request<VersionDetail>(
    "post",
    `/v1/admin/lessons/${lessonId}/versions`,
    {
      data: { content }
    }
  );
};

/** 版本详情（含完整 content JSON） */
export const getVersionApi = (id: string) => {
  return http.request<VersionContentResult>("get", `/v1/admin/versions/${id}`);
};

/** 更新版本内容（仅 DRAFT，409=当前状态不可编辑） */
export const updateVersionContentApi = (id: string, content: unknown) => {
  return http.request<VersionDetail>(
    "put",
    `/v1/admin/versions/${id}/content`,
    {
      data: { content }
    }
  );
};

/** 版本预览（资产 key 已解析为 url，任何状态可调） */
export const getVersionPreviewApi = (id: string) => {
  return http.request<unknown>("get", `/v1/admin/versions/${id}/preview`);
};

/** 送审（仅 DRAFT，422=校验失败，响应含 message + issues） */
export const submitVersionApi = (id: string) => {
  return http.request<VersionDetail>("post", `/v1/admin/versions/${id}/submit`);
};

/** 打回（仅 REVIEWING） */
export const rejectVersionApi = (id: string, reviewNote?: string) => {
  return http.request<VersionDetail>(
    "post",
    `/v1/admin/versions/${id}/reject`,
    {
      data: reviewNote ? { reviewNote } : {}
    }
  );
};

/** 发布（仅 REVIEWING，旧在线版本自动归档） */
export const publishVersionApi = (id: string) => {
  return http.request<VersionDetail>(
    "post",
    `/v1/admin/versions/${id}/publish`
  );
};

/** 回滚（目标须 PUBLISHED/ARCHIVED，400=不可回滚） */
export const rollbackLessonApi = (lessonId: string, versionId: string) => {
  return http.request<unknown>(
    `post`,
    `/v1/admin/lessons/${lessonId}/rollback`,
    {
      data: { versionId }
    }
  );
};

/* ============================== 工具 ============================== */

/** TTS 合成试听（400=合成失败） */
export const ttsAuditionApi = (data: AuditionParams) => {
  return http.request<AuditionResult>("post", "/v1/admin/tts/audition", {
    data
  });
};

/** LLM 连通性自检（永远 200） */
export const llmPingApi = () => {
  return http.request<LlmPingResult>("get", "/v1/admin/llm/ping");
};

/* ============================== 用户管理（仅 ADMIN） ============================== */

/** 用户管理列表项（`GET /v1/admin/users` 返回的数组元素） */
export interface AdminUserItem {
  /** 用户 id（uuid） */
  id: string;
  /** 邮箱 */
  email: string;
  /** 昵称 */
  nickname: string;
  /** 平台角色 */
  role: UserRole;
  /** 注册时间 */
  createdAt: string;
  /** 关联统计 */
  _count: {
    /** 孩子档案数 */
    children: number;
  };
}

/** 修改用户角色返回（`PATCH /v1/admin/users/:id/role`） */
export interface UpdateUserRoleResult {
  /** 用户 id（uuid） */
  id: string;
  /** 邮箱 */
  email: string;
  /** 昵称 */
  nickname: string;
  /** 修改后的角色 */
  role: UserRole;
}

/** 用户列表（按 createdAt 降序，最多 50 条；keyword 匹配邮箱/昵称，省略 = 全量） */
export const getAdminUsersApi = (keyword?: string) => {
  return http.request<AdminUserItem[]>("get", "/v1/admin/users", {
    params: keyword ? { keyword } : {}
  });
};

/**
 * 修改用户角色
 * 成功副作用：该用户所有 token 被吊销，需重新登录
 * 404=用户不存在；400=不能修改自己的角色 / role 非法
 */
export const updateUserRoleApi = (id: string, role: UserRole) => {
  return http.request<UpdateUserRoleResult>(
    "patch",
    `/v1/admin/users/${id}/role`,
    {
      data: { role }
    }
  );
};
