import { http } from "@/utils/http";

/** 登录请求参数（`POST /v1/auth/login`） */
export interface LoginParams {
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
}

/** 刷新令牌请求参数（`POST /v1/auth/refresh`） */
export interface RefreshTokenParams {
  /** 刷新令牌（每次刷新后旧`refreshToken`作废） */
  refreshToken: string;
}

/**
 * 登录/刷新接口返回的令牌对
 * `accessToken`有效期 2 小时，`refreshToken`有效期 14 天
 * 每次刷新双令牌都会换新，旧`refreshToken`立即作废
 */
export interface TokenResult {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
}

/** 平台角色：`PARENT`-家长、`ADMIN`-管理员 */
export type UserRole = "PARENT" | "ADMIN";

/** 当前用户的孩子档案（`GET /v1/users/me`返回的`children`数组元素） */
export interface ChildProfile {
  /** 孩子`id` */
  id: string;
  /** 孩子昵称 */
  nickname: string;
  /** 头像`key` */
  avatarKey: string | null;
  /** 出生年份 */
  birthYear: number;
  /** 出生月份 */
  birthMonth: number;
  /** 每日屏幕时间上限（分钟） */
  dailyMinutes: number;
}

/** 当前登录用户信息（`GET /v1/users/me`） */
export interface UserInfoResult {
  /** 用户`id`（uuid） */
  id: string;
  /** 邮箱 */
  email: string;
  /** 昵称 */
  nickname: string;
  /** 平台角色 */
  role: UserRole;
  /** 孩子档案列表 */
  children: Array<ChildProfile>;
}

/** 登录 */
export const loginApi = (data: LoginParams) => {
  return http.request<TokenResult>("post", "/v1/auth/login", { data });
};

/** 刷新`token`（双令牌轮换，旧`refreshToken`调用后即作废） */
export const refreshTokenApi = (data: RefreshTokenParams) => {
  return http.request<TokenResult>("post", "/v1/auth/refresh", { data });
};

/** 退出登录（需携带`token`，服务端吊销`refreshToken`） */
export const logoutApi = () => {
  return http.request<{ ok: boolean }>("post", "/v1/auth/logout");
};

/** 获取当前登录用户信息（需携带`token`） */
export const getUserInfoApi = () => {
  return http.request<UserInfoResult>("get", "/v1/users/me");
};
