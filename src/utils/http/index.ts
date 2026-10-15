import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { getToken, formatToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // API 基础地址：生产环境为完整 URL（见 .env.production）；开发环境为空则同源，走 vite proxy
  baseURL: import.meta.env.VITE_API_BASE || undefined,
  // 请求超时时间
  timeout: 10000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

/**
 * 请求白名单：不需要携带`token`、也不参与 401 刷新重放的接口
 * （登录/刷新接口返回 401 时直接抛给页面，防止刷新死循环）
 */
const whiteList = ["/v1/auth/login", "/v1/auth/refresh"];

class PureHttp {
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** `token`刷新期间暂存的待重放请求（并发请求共用同一次刷新） */
  private static requests: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  /** 防止重复刷新`token` */
  private static isRefreshing = false;

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 判断是否为白名单接口 */
  private static isWhiteList(url?: string): boolean {
    return whiteList.some(u => url?.endsWith(u));
  }

  /**
   * 刷新`token`（单飞模式：并发请求只刷新一次，其余排队等待结果）
   * 刷新成功：用新`accessToken`依次唤醒队列中的请求
   * 刷新失败（`refreshToken`无效或已过期）：拒绝队列中的全部请求，并清空登录态回登录页
   */
  private static refreshToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      PureHttp.requests.push({ resolve, reject });
      if (PureHttp.isRefreshing) return;
      PureHttp.isRefreshing = true;
      const data = getToken();
      useUserStoreHook()
        .handRefreshToken({ refreshToken: data?.refreshToken })
        .then(res => {
          const token = res.accessToken;
          PureHttp.requests.forEach(cb => cb.resolve(token));
          PureHttp.requests = [];
        })
        .catch(error => {
          PureHttp.requests.forEach(cb => cb.reject(error));
          PureHttp.requests = [];
          // `refreshToken`也失效，清空本地登录态并跳登录页
          useUserStoreHook().clearLoginState();
        })
        .finally(() => {
          PureHttp.isRefreshing = false;
        });
    });
  }

  /** 归一化后端错误信息（`NestJS`统一错误格式`{statusCode, message, error}`，`message`可能是`string`或`string[]`） */
  private static normalizeErrorMessage(error: PureHttpError): void {
    const msg = (error.response?.data as any)?.message;
    if (Array.isArray(msg)) {
      error.message = msg.join("；");
    } else if (typeof msg === "string" && msg) {
      error.message = msg;
    }
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }
        // 白名单接口直接放行（不携带`token`）
        if (PureHttp.isWhiteList(config.url)) return config;
        const data = getToken();
        if (!data) return config;
        const now = new Date().getTime();
        const expired = parseInt(data.expires as any) - now <= 0;
        if (expired) {
          // `accessToken`已过期：先刷新（并发只刷一次），再携带新`token`发起请求
          return PureHttp.refreshToken().then(token => {
            config.headers["Authorization"] = formatToken(token);
            return config;
          });
        }
        config.headers["Authorization"] = formatToken(data.accessToken);
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);
        // 统一把后端错误信息挂到 error.message 上，页面直接取用
        PureHttp.normalizeErrorMessage($error);
        const config = $error.config as PureHttpRequestConfig | undefined;
        const is401 = $error.response?.status === 401;
        if (
          is401 &&
          config &&
          !PureHttp.isWhiteList(config.url) &&
          !config.__isRetryRequest &&
          getToken()
        ) {
          // `accessToken`被服务端判定失效：刷新`token`后重放原请求（只重试一次，防止死循环）
          config.__isRetryRequest = true;
          return PureHttp.refreshToken()
            .then(() => PureHttp.axiosInstance.request(config))
            .catch(() => Promise.reject($error));
        }
        // 其余的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new PureHttp();
