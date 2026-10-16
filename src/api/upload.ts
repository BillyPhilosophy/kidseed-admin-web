import { http } from "@/utils/http";

/**
 * 媒体上传 API 层：预签名 + 前端直传 MinIO
 * 链路：`mediaPresign` 拿预签名 → `uploadFileToMinio` PUT 直传 → 返回的 `key` 即资源键
 * 公网访问地址用 `buildAssetUrl` 拼接
 */

/** 媒体资源类型（image 图片 → kidseed-image 桶；audio 音频 → kidseed-audio 桶） */
export type MediaKind = "image" | "audio";

/** 预签名请求参数（`POST /v1/admin/media/presign`） */
export interface MediaPresignParams {
  /** 原始文件名（含扩展名） */
  filename: string;
  /** 文件 MIME 类型（如 `image/png`） */
  contentType: string;
  /** 资源类型 */
  kind: MediaKind;
}

/** 预签名返回（`POST /v1/admin/media/presign`，200） */
export interface MediaPresignResult {
  /** MinIO 预签名 PUT 地址 */
  url: string;
  /** 直传时必须逐个设置的请求头 */
  headers: Record<string, string>;
  /** 资源键（上传成功后即为业务字段值，如单元 coverKey） */
  key: string;
}

/** 获取媒体上传预签名 */
export const mediaPresign = (data: MediaPresignParams) => {
  return http.request<MediaPresignResult>("post", "/v1/admin/media/presign", {
    data
  });
};

/**
 * 前端直传 MinIO（PUT 预签名地址，body 为文件二进制）
 * 注意：故意不走 `@/utils/http` 的 axios 封装——直传 MinIO 域名，
 * 不能携带 Authorization 头、也不能拼 baseURL，故用原生 fetch
 */
export const uploadFileToMinio = async (
  presign: MediaPresignResult,
  file: File
): Promise<void> => {
  const resp = await fetch(presign.url, {
    method: "PUT",
    headers: presign.headers,
    body: file
  });
  if (!resp.ok) {
    throw new Error(`上传失败: HTTP ${resp.status}`);
  }
};

/** kind → MinIO bucket 映射 */
const KIND_BUCKET: Record<MediaKind, string> = {
  image: "kidseed-image",
  audio: "kidseed-audio"
};

/** 拼接资源公网访问地址（`{VITE_MINIO_PUBLIC}/{bucket}/{key}`）；key 为空返回空串 */
export const buildAssetUrl = (kind: MediaKind, key: string): string => {
  if (!key) return "";
  return `${import.meta.env.VITE_MINIO_PUBLIC}/${KIND_BUCKET[kind]}/${key}`;
};
