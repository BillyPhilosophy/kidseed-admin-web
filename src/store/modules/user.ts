import { defineStore } from "pinia";
import {
  type userType,
  store,
  router,
  resetRouter,
  routerArrays,
  storageLocal
} from "../utils";
import {
  type LoginParams,
  type RefreshTokenParams,
  type TokenResult,
  type UserInfoResult,
  loginApi,
  logoutApi,
  refreshTokenApi,
  getUserInfoApi
} from "@/api/user";
import { buildAssetUrl } from "@/api/upload";
import { useMultiTagsStoreHook } from "./multiTags";
import { getPermsByRole } from "@/constants/perms";
import { type DataInfo, setToken, removeToken, userKey } from "@/utils/auth";

/** 后端`accessToken`有效期为 2 小时（后端不下发过期时间，本地据此推算） */
const ACCESS_TOKEN_EXPIRES_IN = 2 * 60 * 60 * 1000;

export const useUserStore = defineStore("pure-user", {
  state: (): userType => ({
    // 当前登录用户 id（uuid，用于用户管理页「不能改自己」比对等场景）
    id: storageLocal().getItem<DataInfo<number>>(userKey)?.id ?? "",
    // 头像
    avatar: storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "",
    // 用户名（记录登录邮箱）
    username: storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "",
    // 页面级别权限
    roles: storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [],
    // 按钮级别权限
    permissions:
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [],
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    /** 存储当前登录用户 id */
    SET_ID(id: string) {
      this.id = id;
    },
    /** 存储头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    /** 存储按钮级别权限 */
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    /**
     * 登入（邮箱+密码）
     * 流程：`POST /v1/auth/login`换双令牌 → 先存令牌 → `GET /v1/users/me`拉用户信息 → 写入角色
     */
    async loginByEmail(data: LoginParams): Promise<UserInfoResult> {
      const tokenInfo = await loginApi(data);
      const expires = new Date(Date.now() + ACCESS_TOKEN_EXPIRES_IN);
      // 先持久化令牌，保证拉取用户信息时请求能携带 Authorization
      setToken({ ...tokenInfo, expires });
      const userInfo = await getUserInfoApi();
      // 再写入用户信息：username 记录邮箱，roles 适配模板的角色数组机制，
      // permissions 按 role 从 ROLE_PERMISSIONS 映射推导（按钮级权限），
      // avatar 由 avatarKey 经 buildAssetUrl 拼成公网 URL（无头像存空串）
      setToken({
        ...tokenInfo,
        expires,
        id: userInfo.id,
        username: userInfo.email,
        nickname: userInfo.nickname,
        avatar: userInfo.avatarKey
          ? buildAssetUrl("image", userInfo.avatarKey)
          : "",
        roles: [userInfo.role],
        permissions: getPermsByRole(userInfo.role)
      });
      return userInfo;
    },
    /**
     * 资料更新后同步登录态（`PATCH /v1/users/me`成功后调用）：
     * 更新 store 的昵称/头像并持久化到本地`user-info`，导航栏立即刷新
     */
    syncProfile(userInfo: UserInfoResult) {
      const avatar = userInfo.avatarKey
        ? buildAssetUrl("image", userInfo.avatarKey)
        : "";
      this.nickname = userInfo.nickname;
      this.avatar = avatar;
      const data = storageLocal().getItem<DataInfo<number>>(userKey);
      if (data) {
        storageLocal().setItem(userKey, {
          ...data,
          nickname: userInfo.nickname,
          avatar
        });
      }
    },
    /**
     * 退出登录：先调`POST /v1/auth/logout`让服务端吊销`refreshToken`
     * （接口失败也照常清理本地登录态），然后清空登录态并回登录页
     */
    async logOut() {
      try {
        await logoutApi();
      } catch {
        // 登出接口失败（如`token`已失效）不影响本地清理
      } finally {
        this.clearLoginState();
      }
    },
    /** 清空本地登录态并回登录页（退出登录、刷新令牌失效时共用） */
    clearLoginState() {
      this.id = "";
      this.avatar = "";
      this.username = "";
      this.nickname = "";
      this.roles = [];
      this.permissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
      router.push("/login");
    },
    /**
     * 刷新`token`（`POST /v1/auth/refresh`，双令牌轮换，旧`refreshToken`调用后作废）
     * 用户信息（`username`/`roles`等）由`setToken`从本地存储中保留
     */
    async handRefreshToken(data: RefreshTokenParams): Promise<TokenResult> {
      const tokenInfo = await refreshTokenApi(data);
      setToken({
        ...tokenInfo,
        expires: new Date(Date.now() + ACCESS_TOKEN_EXPIRES_IN)
      });
      return tokenInfo;
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
