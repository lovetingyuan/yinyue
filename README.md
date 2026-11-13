# Nuxt + Capacitor

项目根目录使用 Nuxt 4、Vue 3 和 TypeScript，首页保留 Nuxt 欢迎页。样式使用 Tailwind CSS 4 和 daisyUI 5，移动端保留现有 Capacitor Android 工程。

## Web 开发

推荐使用 Node.js 24.18（版本见 `.node-version`；最低兼容版本为 22.22.3 或 24.15）：

```bash
npm install
npm run dev
```

开发地址为 `http://127.0.0.1:5173`，端口被占用时直接报错。`npm start` 同样启动开发服务。

```bash
npm run lint
npm run lint:fix
npm run typecheck
npm run build
npm run preview
```

代码检查使用 [Oxlint](https://oxc.rs/docs/guide/usage/linter)，`lint:fix` 自动修复可安全修复的问题。配置位于 `.oxlintrc.json`，启用正确性检查及内置 Vue 规则，遵循 `.gitignore` 并排除 Android 工程和生成的 Cloudflare 类型声明。Vue 文件仅检查 `<script>` 部分，类型检查仍使用 `typecheck`。

`build` 使用初始项目的 Cloudflare Worker 配置，服务端入口为 `.output/server/index.mjs`，静态资源位于 `.output/public/`。`preview` 先构建再通过 Wrangler 本地预览。

`npm run generate` 可生成 Web 静态站点。`npm run deploy` 构建并部署到 Cloudflare；部署前检查 `wrangler.jsonc` 中的 Worker 名称及账户配置。`npm run cf-typegen` 更新 Cloudflare 类型声明。

## 目录与样式

- `app/app.vue`：应用入口，使用 `NuxtWelcome`。
- `app/assets/css/main.css`：全局样式，引入 Tailwind、注册 daisyUI，并保留安全区边距。
- `app/plugins/capacitor.client.ts`：应用挂载后在原生平台隐藏启动屏。
- `nuxt.config.ts`：Nuxt、Tailwind Vite 插件和构建环境配置。
- `public/`：静态资源，原项目 Logo 和图标保留在 `public/assets/`。
- `server/`、`_cloudflare/`：服务端及 Cloudflare 类型声明。

Tailwind 按[官方 Nuxt 指南](https://tailwindcss.com/docs/installation/framework-guides/nuxt)通过 `@tailwindcss/vite` 接入。可直接在 Vue 模板中使用工具类与 daisyUI 组件类：

```html
<button class="btn btn-primary mt-4">开始</button>
```

## Android 构建与热更新

需要 JDK 21+、Android SDK 36 和 Platform-Tools。设置 `JAVA_HOME`、`ANDROID_HOME`；真机开启 USB 调试并授权，或启动 Android 模拟器。

```bash
npm run build:mobile
npx cap sync android

# 构建、安装并开启热更新
npm run android

# 查看真机及模拟器的 Target ID
npm run android:devices

# 指定设备
npm run android -- --target <ID>
```

移动端使用 `capacitor` 配置环境关闭 SSR，静态资源独立生成到 `.output-capacitor/public/`，该路径也是 Capacitor 的 `webDir`，与 Web 构建产物互不覆盖。

`npm run android` 先构建移动端资源，再同时启动 Nuxt 移动端开发服务和 Capacitor live-reload。应用加载 `http://127.0.0.1:5173`，通过 ADB 端口转发连接电脑，无需配置局域网 IP。`npm run dev:mobile` 可单独启动此模式的开发服务。

运行前请连接并授权手机，或先启动模拟器。启动命令通过 `scripts/android-reverse.mjs` 为指定的 `--target`（未指定时为已连接设备）建立持续的 ADB 转发，避免 `native-run` 在部署完成时撤销转发，导致页面脚本加载失败。USB 断开后需要重新运行命令恢复转发。

保持终端运行即可使用热更新，按 Ctrl+C 停止。原生代码或插件变更后重新运行命令。在电脑 Chrome 打开 `chrome://inspect/#devices`，点击应用 WebView 的 **inspect** 调试。

若默认 Java 是 17，可在 PowerShell 中临时切换到已安装的 JDK 21：

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
npm run android
```

Android 应用 ID 仍为 `com.tingyuan.music`，应用名称为 `music-cap`，原生系统栏继续跟随系统主题。
