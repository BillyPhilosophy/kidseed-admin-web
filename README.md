# kidseed-admin-web

kidseed 儿童学习平台的管理后台。基于 [pure-admin-thin](https://github.com/pure-admin/pure-admin-thin)（Vue 3 + Element Plus + Vite + pnpm）改造，对接后端 [kidseed-api](https://github.com/BillyPhilosophy/kidseed-api)（NestJS）。

## 功能现状

- **登录鉴权**：邮箱 + 密码登录，双 token（access/refresh）自动刷新；`ADMIN` / `EDITOR` 角色可访问，`PARENT` 登录提示无权限
- **RBAC 权限**：`EDITOR`（内容编辑）可管理课程树与版本、送审、试听；**发布 / 打回 / 回滚仅 `ADMIN`**（按钮按 `v-perms` 不渲染，后端 Guard 双重拦截 403）；role → permissions 映射见 `src/constants/perms.ts`
- **用户管理**（仅 ADMIN）：`/users` 用户列表检索、在线修改角色（修改后对方登录状态失效需重登，不能改自己）
- **课程树管理**：单元 / 课程 CRUD，单元封面上传（presign → PUT 直传 MinIO）、课程树缩略图预览；课程内容版本管理（草稿 → 提交 → 审核 / 发布 → 回滚的状态机操作）
- **工具箱**（仅 ADMIN）：TTS 试听、LLM 连通性自检

## 本地开发

前置要求：

- Node ≥ 20，pnpm ≥ 9
- 后端 kidseed-api 跑在 `localhost:3000`（在 kidseed-api 仓库执行 `npm run dev:up && npm run start:dev`）

```bash
pnpm install
pnpm dev
```

开发服务器端口 `8848`，`/v1` 请求由 vite proxy 转发到 `http://localhost:3000`（见 `vite.config.ts`），无需处理跨域。

登录账号需要先在 API 侧注册。**首个管理员**用 kidseed-api 仓库的 `scripts/promote-admin.js` 提升；之后的角色变更直接在后台 `/users` 页面操作（或调 `PATCH /v1/admin/users/:id/role`，仅 ADMIN）。

## 构建

```bash
pnpm typecheck   # tsc + vue-tsc 类型检查
pnpm build       # 产物输出到 dist/（纯静态文件）
```

## 部署

生产站点 `https://admin.twilightknight.space` 部署在树莓派的 openresty（1Panel）上，纯静态文件，无 SSR。

### GitHub Actions 自动部署

push 到 `main`（或 Actions 页手动触发）→ 安装依赖 → `pnpm typecheck` → `pnpm build` → rsync 推送 `dist/` 到树莓派站点目录。工作流见 `.github/workflows/deploy.yml`。

需要在仓库 **Settings → Secrets and variables → Actions** 配置 5 个 secret：

| Secret            | 说明                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `PI_SSH_PASSWORD` | 树莓派 SSH 密码                                                                                  |
| `PI_SSH_PORT`     | SSH 端口                                                                                         |
| `PI_SSH_USER`     | SSH 用户                                                                                         |
| `PI_SSH_HOST`     | 树莓派地址                                                                                       |
| `PI_DEPLOY_PATH`  | 站点目录，值为 `/opt/1panel/apps/openresty/openresty/www/sites/admin.twilightknight.space/index` |

### openresty（1Panel）侧配置

当前生产构建为 **hash 路由模式**（`.env.production` 的 `VITE_ROUTER_HISTORY = "hash"`，URL 形如 `/#/course`），hash 部分不发送到服务器，**无需任何 rewrite 配置**，任意路径刷新都不会 404。

若以后想换成干净的 h5 history 模式（改成 `"h5"`），则必须在站点配置加 SPA 回退，否则刷新非首页路径会 404：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 生产环境 API 地址与跨域

- 前端：`.env.production` 里的 `VITE_API_BASE=https://api.twilightknight.space` 在构建时写入产物，浏览器直连 API 域名
- 后端：kidseed-api 的生产环境变量 `CORS_ORIGINS` **必须包含 `https://admin.twilightknight.space`**（其 `.env.example` 已包含），否则浏览器跨域拦截

## 目录结构

- `src/api` — 后端接口封装（`admin.ts` 管理端接口、`user.ts` 登录 / 用户信息、`upload.ts` 媒体预签名与 MinIO 直传），页面只从这里调接口
- `src/views/course` — 课程树管理页（单元 / 课程表单、`CoverUpload` 封面上传、版本内容与预览等弹窗组件）
- `src/views/users` — 用户管理页（仅 ADMIN，在线修改角色）
- `src/views/tools` — 工具箱页（TTS 试听、LLM 自检，仅 ADMIN）
- `src/router/modules` — 路由模块（`course.ts`、`tools.ts`、`users.ts`、`home.ts` 等，`meta.roles` 控制可见可访问）
- `src/constants/perms.ts` — role → permissions 映射（按钮级 `v-perms` 的数据源）
- `src/utils/http` — axios 封装（token 注入、401 单飞刷新重放、NestJS 错误信息归一化）
