# inYue

项目使用 Nuxt 和 Capacitor，支持 Web 和 Android。账号、会话、歌曲与歌单记录存入 D1，音频与封面存入私有 R2，由绑定会话的签名地址读取。实施与验收记录见 [PLAN.md](PLAN.md)。

## Web 开发

推荐使用 Node.js 24.18（版本见 `.node-version`；最低兼容版本为 22.22.3 或 24.15）：

```bash
npm install
npx wrangler d1 migrations apply music-library --local
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

`build` 使用 Cloudflare Worker 配置，服务端入口为 `.output/server/index.mjs`，静态资源位于 `.output/public/`。`preview` 先构建再通过 Wrangler 本地预览。

`npm run generate` 可生成 Web 静态站点。`npm run deploy` 构建并部署到 Cloudflare；部署前检查 `wrangler.jsonc` 中的 Worker 名称及账户配置。`npm run cf-typegen` 更新 Cloudflare 类型声明。

## 目录与样式

- `app/app.vue`：登录、注册、邮箱验证入口、密码重置和会话状态。
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

# 安装调试包并开启热更新
npm run android

# 查看真机及模拟器的 Target ID
npm run android:devices

# 指定设备
npm run android -- --target <ID>
```

移动端使用 `capacitor` 配置环境关闭 SSR，静态资源独立生成到 `.output-capacitor/public/`，该路径也是 Capacitor 的 `webDir`，与 Web 构建产物互不覆盖。

`npm run android` 启动 Nuxt 移动端开发服务，或复用本项目已启动的移动服务，等页面和 Vite 客户端就绪后安装调试包。WebView 通过 ADB 转发加载 `http://127.0.0.1:5174`，页面、热更新和默认本地 API 都使用这个地址。若其他程序占用 5174，请先释放该端口。Web 开发使用 5173。可通过 `NUXT_PUBLIC_MOBILE_API_ORIGIN` 指定其他后端，该后端需允许热更新页面的源。

运行前请连接并授权手机，或先启动模拟器。连接多台设备时使用 `--target`。Windows PowerShell 可用 `npm.cmd run android -- --target <ID>`，确保参数传给脚本。USB 重连后，若服务还在运行，可用 SDK 自带的 `adb reverse tcp:5174 tcp:5174` 恢复转发，再重开 App。

保持启动移动开发服务的终端运行即可使用热更新，按 Ctrl+C 停止服务。复用服务时，`npm run android` 安装并启动 App 后会退出。原生代码或插件变更后重新运行命令。在电脑 Chrome 打开 `chrome://inspect/#devices`，点击应用 WebView 的 **inspect** 调试。

若默认 Java 是 17，可在 PowerShell 中临时切换到已安装的 JDK 21：

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
npm run android
```

Android 应用 ID 为 `com.tingyuan.inyue`，应用名称为 `inYue`，原生系统栏继续跟随系统主题。

## 服务配置

| 变量                                                        | 用途                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NUXT_PUBLIC_SITE_URL`                                      | Worker 对外的规范 HTTPS 地址。本地开发可用 `http://127.0.0.1:5173`                         |
| `NUXT_BETTER_AUTH_SECRET`                                   | 认证密钥，至少 32 个字符                                                                   |
| `NUXT_PUBLIC_MOBILE_API_ORIGIN`                             | 打包 Android 时指定的 API HTTPS 源，例如与站点同源                                         |
| `NUXT_PUBLIC_ANDROID_ORIGIN`                                | Worker 允许的 Android WebView 源，打包默认 `https://localhost`，热更新时配置为实际热更新源 |
| `NUXT_RESEND_API_KEY`、`NUXT_MAIL_FROM`                     | Resend API 密钥和已验证域名下的发信地址                                                    |
| `NUXT_MAIL_PREVIEW`                                         | 本地使用 `true`，验证和重置链接输出至本地日志                                              |
| `NUXT_PUBLIC_GOOGLE_CLIENT_ID`、`NUXT_GOOGLE_CLIENT_SECRET` | 可选。Google Web OAuth 客户端 ID 与密钥                                                    |
| `NUXT_MEDIA_SIGNING_SECRET`                                 | 媒体签名密钥，至少 32 个字符，与认证密钥分别生成                                           |
| `NUXT_LIBRARY_QUOTA_BYTES`                                  | 每用户存储额度，默认 1,073,741,824 字节                                                    |

Nuxt 开发时将变量写入项目根目录的 `.env`，Wrangler 预览时可使用 `.dev.vars`。部署时使用 Worker 变量与 Cloudflare Secrets，并将 `wrangler.jsonc` 的 Worker 名称、`DB` 的数据库名称和 ID、`MEDIA` 的私有桶名称替换为实际资源。通过 `npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc` 应用生产迁移。

Google 启用时，在 Web OAuth 客户端登记 `<站点地址>/api/auth/callback/google`，并为 Android 登记包名 `com.tingyuan.inyue` 和对应签名证书的 SHA-1。Android Credential Manager 使用 Web 客户端 ID 请求 ID token。当前 Google 验收搁置。

## 本地集成验证

先创建项目下的 `temp/`，再在 `temp/worker.env` 配置本地变量。使用独立的随机认证和媒体签名密钥。

```dotenv
NUXT_PUBLIC_SITE_URL=http://127.0.0.1:8794
NUXT_BETTER_AUTH_SECRET=
NUXT_MEDIA_SIGNING_SECRET=
NUXT_MAIL_PREVIEW=true
NUXT_INTEGRATION_PLAYBACK=true
```

用 PowerShell 准备三段 15 秒的测试音频，并启动 Worker。需要 FFmpeg。

```powershell
npx wrangler d1 migrations apply DB --local --config wrangler.jsonc
foreach ($track in 1..3) {
    $tone = 180 + 90 * $track
    ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=${tone}:sample_rate=44100" -t 15 -af volume=0.1 -b:a 96k "temp/integration-$track.mp3"
    npx wrangler r2 object put "music-library-media/integration/$track.mp3" --local --config wrangler.jsonc --file "temp/integration-$track.mp3"
}
npm run build
npx wrangler dev --config wrangler.jsonc --env-file temp/worker.env --port 8794 *> temp/worker-phase1.log
```

另开终端执行：

```powershell
node scripts/verify-auth-media.mjs
$env:NUXT_PUBLIC_INTEGRATION_PLAYBACK = 'true'
$env:NUXT_PUBLIC_MOBILE_LOCAL_TEST = 'true'
$env:NUXT_PUBLIC_MOBILE_API_ORIGIN = 'http://127.0.0.1:8794'
$env:NUXT_PUBLIC_SITE_URL = $env:NUXT_PUBLIC_MOBILE_API_ORIGIN
npm run build:mobile
npx cap sync android
adb reverse tcp:8794 tcp:8794
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

在 Android 注册后，从 Worker 日志打开邮箱验证链接，再返回手机登录并载入测试音频。测试界面可切换三种队列模式、跳到第 8 秒和切歌。锁屏后可用 `adb shell dumpsys media_session` 检查媒体会话、曲目和位置。验证使用 Android 调试包中的本机 HTTP 配置。

测试完整音乐库时，移除移动端构建变量 `NUXT_PUBLIC_INTEGRATION_PLAYBACK`，保留本地测试 API 设置。部署构建使用实际 HTTPS API 地址。

本地并发额度验证可另启 Wrangler 端口，使用该端口作为 `NUXT_PUBLIC_SITE_URL`，配置 `NUXT_LIBRARY_QUOTA_BYTES=250000`，并以 `MUSIC_TEST_ORIGIN` 和 `MUSIC_TEST_QUOTA=true` 运行验证脚本。Worker 每 15 分钟重试删除残留对象并回收超时上传。
