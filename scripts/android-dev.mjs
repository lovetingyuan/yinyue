import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import concurrently from "concurrently";
import { androidDevOrigin, androidDevPort } from "../shared/android-dev.mjs";

const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
const target =
  targetIndex === -1
    ? args.find((arg) => arg.startsWith("--target="))?.slice("--target=".length)
    : args[targetIndex + 1];
if (args.length && (!target || args.length !== (targetIndex === -1 ? 1 : 2))) {
  throw new Error("用法：npm run android -- --target <ID>");
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw new Error("请设置 ANDROID_HOME 指向 Android SDK。");
const adb = join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const devices = execFileSync(adb, ["devices"], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => /^(\S+)\s+device$/.exec(line.trim())?.[1])
  .filter(Boolean);
if (devices.length === 0 || (target && !devices.includes(target))) {
  throw new Error("未找到可用的 Android 设备。请连接并授权真机，或启动模拟器。");
}
if (!target && devices.length > 1) {
  throw new Error(`检测到多个设备，请通过 --target 指定一个：${devices.join("、")}`);
}
const device = target || devices[0];

if (process.env.INYUE_ANDROID_DEPLOY !== "1" && !hasMobileDevServer()) {
  const { result } = concurrently(
    [
      { name: "nuxt", command: "npm run dev:mobile" },
      {
        name: "android",
        command: "node scripts/android-dev.mjs {@}",
        env: { INYUE_ANDROID_DEPLOY: "1" },
      },
    ],
    { additionalArguments: args, killOthersOn: "failure" },
  );
  await result.catch(() => {
    process.exitCode = 1;
  });
} else {
  if (process.env.INYUE_ANDROID_DEPLOY !== "1") {
    console.log(`复用本项目的 Nuxt 移动开发服务：${androidDevOrigin}`);
  }
  await deploy();
}

function hasMobileDevServer() {
  // Nuxt keeps the mobile server's lock separate from the Web server's .nuxt lock.
  try {
    const lock = JSON.parse(readFileSync("temp/nuxt-android/nuxt.lock", "utf8"));
    if (
      lock.command !== "dev" ||
      lock.cwd !== process.cwd().replaceAll("\\", "/") ||
      lock.url !== androidDevOrigin ||
      !Number.isInteger(lock.pid) ||
      lock.pid <= 0
    ) {
      return false;
    }
    process.kill(lock.pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function deploy() {
  let ready = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if ((await isReady("/", "text/html")) && (await isReady("/_nuxt/@vite/client", "javascript"))) {
      ready = true;
      break;
    }
    await setTimeout(500);
  }
  if (!ready) throw new Error(`Nuxt 开发服务未就绪：${androidDevOrigin}`);

  async function isReady(path, contentType) {
    const response = await fetch(`${androidDevOrigin}${path}`, {
      signal: AbortSignal.timeout(3_000),
    }).catch(() => undefined);
    await response?.body?.cancel();
    return response?.ok && response.headers.get("content-type")?.includes(contentType);
  }

  // Keep the ADB mapping active after deployment for both HTTP and Vite HMR.
  const port = `tcp:${androidDevPort}`;
  execFileSync(adb, ["-s", device, "reverse", port, port], { stdio: "inherit" });
  const require = createRequire(import.meta.url);
  const configPath = "android/app/src/main/assets/capacitor.config.json";
  const previousConfig = existsSync(configPath) ? readFileSync(configPath) : undefined;
  try {
    execFileSync(
      process.execPath,
      [require.resolve("@capacitor/cli/bin/capacitor"), "sync", "android"],
      {
        stdio: "inherit",
        env: { ...process.env, INYUE_ANDROID_DEV: "1" },
      },
    );
    if (process.platform === "win32") {
      execFileSync("cmd.exe", ["/d", "/c", "gradlew.bat", "assembleDebug"], {
        cwd: "android",
        stdio: "inherit",
      });
    } else {
      execFileSync("./gradlew", ["assembleDebug"], { cwd: "android", stdio: "inherit" });
    }
  } finally {
    if (previousConfig) writeFileSync(configPath, previousConfig);
    else rmSync(configPath, { force: true });
  }
  execFileSync(
    adb,
    ["-s", device, "install", "-r", "android/app/build/outputs/apk/debug/app-debug.apk"],
    { stdio: "inherit" },
  );
  // Wait for the launch request only. Waiting for the first rendered frame can
  // time out during cold starts and causes native-run to restart the ADB server.
  execFileSync(
    adb,
    ["-s", device, "shell", "am", "start", "-n", "com.tingyuan.inyue/.MainActivity"],
    { stdio: "inherit" },
  );
  console.log(`Android 已部署，热更新地址：${androidDevOrigin}`);
}
