// 本项目已对接真实后端（/v1 前缀接口），不再使用 mock 数据。
// 保留该空路由文件是因为 build/plugins.ts 中的 vite-plugin-fake-server 要求 mock 目录必须存在，
// 定义空数组即不注册任何 mock 接口。
import { defineFakeRoute } from "vite-plugin-fake-server/client";

export default defineFakeRoute([]);
