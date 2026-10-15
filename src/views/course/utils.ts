import dayjs from "dayjs";
import type { Track, VersionStatus } from "@/api/admin";

/** 赛道选项（值 = 后端枚举，标签 = 中文） */
export const trackOptions: Array<{ label: string; value: Track }> = [
  { label: "中文", value: "CHINESE" },
  { label: "英语", value: "ENGLISH" },
  { label: "数学", value: "MATH" },
  { label: "通识", value: "GENERAL" }
];

/** 赛道枚举转中文标签 */
export const trackLabel = (track: Track): string =>
  trackOptions.find(o => o.value === track)?.label ?? track;

/** 版本状态展示元信息（中文标签 + el-tag 类型） */
export const statusMeta: Record<
  VersionStatus,
  { label: string; type: "info" | "warning" | "success" | "primary" }
> = {
  DRAFT: { label: "草稿", type: "info" },
  REVIEWING: { label: "审核中", type: "warning" },
  PUBLISHED: { label: "已发布", type: "success" },
  ARCHIVED: { label: "已归档", type: "primary" }
};

/** 时间格式化（空值显示占位符） */
export const fmtTime = (time?: string | null): string =>
  time ? dayjs(time).format("YYYY-MM-DD HH:mm") : "—";
