<script setup lang="ts">
import type LibraryPage from "~/pages/index.vue";

const { native, request, signIn, signOut } = useMusicApi();
const auth = useAuthClient();
const config = useRuntimeConfig().public;
const url = useRequestURL();
const mode = ref<"login" | "register" | "forgot" | "reset">("login");
const email = ref("");
const name = ref("");
const password = ref("");
const resetToken = ref(url.searchParams.get("token") ?? "");
const notice = ref("");
const error = ref("");
const busy = ref(false);
const loading = ref(true);
const player = useTemplateRef("player");
const page = useTemplateRef<{ pageRef?: InstanceType<typeof LibraryPage> }>("page");
const profile = useTemplateRef("profile");
const account = ref<{
  id: string; name: string; email: string; image?: string | null; storage: { usedBytes: number; quotaBytes: number };
}>();
const theme = ref("system");
const offline = ref(false);

useHead({ htmlAttrs: { lang: "zh-CN", "data-theme": () => theme.value === "system" ? undefined : theme.value } });

function bytes(size: number) {
  return size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(2)} GiB` : `${(size / 1024 ** 2).toFixed(1)} MiB`;
}

function updateConnection() {
  const wasOffline = offline.value;
  offline.value = !navigator.onLine;
  if (wasOffline && !offline.value) void loadAccount().catch(() => { account.value = undefined; });
}
watch(theme, (value) => { if (import.meta.client) localStorage.setItem("music-theme", value); });
onBeforeUnmount(() => {
  window.removeEventListener("online", updateConnection);
  window.removeEventListener("offline", updateConnection);
});

async function loadAccount() {
  const response = await request<typeof account.value>("/api/account");
  account.value = response._data;
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  notice.value = "";
  error.value = "";
  try {
    await action();
  } catch (cause) {
    const data = typeof cause === "object" && cause !== null && "data" in cause ? cause.data : undefined;
    const code = typeof data === "object" && data !== null && "code" in data ? data.code : undefined;
    error.value = code === "EMAIL_NOT_VERIFIED" ? "请先验证邮箱。" : code === "INVALID_EMAIL_OR_PASSWORD"
      ? "邮箱或密码错误。" : "操作失败，请检查网络和输入后重试。";
  } finally {
    busy.value = false;
  }
}

async function submit() {
  if (mode.value === "register") {
    await request("/api/auth/sign-up/email", { method: "POST", body: { name: name.value, email: email.value, password: password.value, callbackURL: "/" } });
    notice.value = "请查收验证邮件。";
    mode.value = "login";
  } else if (mode.value === "forgot") {
    await request("/api/auth/request-password-reset", { method: "POST", body: { email: email.value, redirectTo: "/" } });
    notice.value = "如果该邮箱已注册，请查收重置邮件。";
  } else if (mode.value === "reset") {
    await request("/api/auth/reset-password", { method: "POST", body: { token: resetToken.value, newPassword: password.value } });
    resetToken.value = "";
    history.replaceState(null, "", "/");
    mode.value = "login";
    notice.value = "密码已重置，请登录。";
  } else {
    await signIn({ email: email.value, password: password.value });
    await loadAccount();
  }
  password.value = "";
}

async function resend() {
  if (!email.value) {
    notice.value = "请填写邮箱。";
    return;
  }
  await request("/api/auth/send-verification-email", { method: "POST", body: { email: email.value, callbackURL: "/" } });
  notice.value = "请查收验证邮件。";
}

async function google() {
  if (native) {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({ google: { webClientId: config.googleClientId } });
    const { result } = await SocialLogin.login({ provider: "google", options: {} });
    if (!("idToken" in result) || !result.idToken) throw new Error("Google ID token is missing");
    await signIn({ provider: "google", idToken: { token: result.idToken } });
    await loadAccount();
    return;
  }
  const result = await auth?.signIn.social({ provider: "google", callbackURL: "/" });
  if (result?.error) throw new Error(result.error.message);
}

async function logout() {
  await page.value?.pageRef?.release();
  await player.value?.release();
  await signOut();
  if (account.value) localStorage.removeItem(`music-playback:${account.value.id}`);
  profile.value?.close();
  account.value = undefined;
  await navigateTo("/", { replace: true });
}

onMounted(async () => {
  const savedTheme = localStorage.getItem("music-theme");
  if (savedTheme === "light" || savedTheme === "dark") theme.value = savedTheme;
  updateConnection();
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  resetToken.value = new URLSearchParams(location.search).get("token") ?? "";
  if (resetToken.value) mode.value = "reset";
  if (offline.value) {
    loading.value = false;
    return;
  }
  try {
    await loadAccount();
  } catch (cause) {
    if (typeof cause !== "object" || cause === null || !("statusCode" in cause) || ![401, 403].includes(Number(cause.statusCode))) {
      error.value = "暂时无法连接音乐库。";
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPwaManifest />
  <main v-if="account && !config.integrationPlayback" class="app-height mx-auto flex max-w-[100rem] flex-col" :class="{ 'select-none': native }">
    <header class="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 md:px-6 md:py-3">
      <NuxtLink to="/" class="flex items-center gap-2.5 rounded-field" aria-label="inyue 曲库">
        <span class="grid size-9 place-items-center rounded-xl bg-primary text-primary-content"><MusicIcon name="wave" /></span>
        <h1 class="text-[1.4rem] leading-none font-bold tracking-tight">inyue</h1>
      </NuxtLink>
      <button class="btn btn-ghost btn-circle border border-base-300/65 bg-base-200" aria-label="个人设置" aria-haspopup="dialog" @click="showMusicDialog(profile)">
        <img v-if="account.image" :src="account.image" alt="" referrerpolicy="no-referrer" class="size-9 rounded-full object-cover">
        <span v-else class="text-primary">{{ account.name.slice(0, 1) }}</span>
      </button>
    </header>
    <p v-if="offline" class="alert alert-info alert-soft m-3" role="status">当前离线，连接网络后可访问音乐库。</p>
    <NuxtPage v-else ref="page" :key="account.id" :user-id="account.id" :native="native" @changed="loadAccount().catch(() => undefined)" />
    <dialog ref="profile" class="modal modal-bottom sm:modal-middle" aria-labelledby="profile-title" @cancel="busy && $event.preventDefault()">
      <div class="modal-box safe-panel grid gap-4">
        <div>
          <h2 id="profile-title" class="text-xl font-bold">{{ account.name }}</h2>
          <p class="mt-1 break-all text-sm text-base-content/70">{{ account.email }}</p>
        </div>
        <label class="grid gap-1.5 text-sm font-medium">存储用量 {{ bytes(account.storage.usedBytes) }} / {{ bytes(account.storage.quotaBytes) }}
          <progress class="progress progress-primary w-full" :value="account.storage.usedBytes" :max="account.storage.quotaBytes" />
        </label>
        <label class="grid gap-1.5 text-sm font-medium">主题
          <select v-model="theme" class="select w-full">
            <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
          </select>
        </label>
        <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <form method="dialog"><button class="btn btn-ghost" :disabled="busy">关闭</button></form>
          <button class="btn btn-error btn-outline" :disabled="busy" @click="run(logout)">退出登录</button>
        </div>
      </div>
    </dialog>
  </main>
  <main v-else class="app-height grid overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(26rem,0.8fr)]" :class="{ 'select-none': native }">
    <div class="hidden place-items-center overflow-hidden bg-neutral p-10 text-neutral-content md:grid" aria-hidden="true">
      <MusicArtwork class="w-full max-w-md rotate-[-8deg] shadow-2xl" />
    </div>
    <div class="grid content-center justify-items-center px-5 py-8">
      <div class="card w-full max-w-sm">
        <div class="card-body gap-4 p-2 sm:p-4">
          <header class="mb-4 flex items-center gap-3">
            <span class="grid size-11 place-items-center rounded-xl bg-primary text-primary-content"><MusicIcon name="wave" class="size-6" /></span>
            <h1 class="text-3xl font-bold tracking-tight">inyue</h1>
          </header>
          <p v-if="offline" role="status">当前离线，连接网络后可访问音乐库。</p>
          <p v-else-if="loading" role="status" class="flex items-center gap-2 text-sm text-base-content/65">
            <span class="loading loading-spinner loading-xs" aria-hidden="true" /> 正在检查会话…
          </p>
          <template v-else-if="account">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="card-title">{{ account.name }}</h2>
                <p class="break-all text-sm">{{ account.email }}</p>
              </div>
              <button class="btn btn-sm" type="button" :disabled="busy" @click="run(logout)">退出登录</button>
            </div>
            <IntegrationPlayer v-if="config.integrationPlayback" ref="player" />
          </template>
          <template v-else>
            <h2 class="text-2xl font-bold tracking-tight">{{ { login: "登录", register: "注册", forgot: "找回密码", reset: "重置密码" }[mode] }}</h2>
            <form class="grid gap-3" @submit.prevent="run(submit)">
              <label v-if="mode === 'register'" class="grid gap-1.5 text-sm font-medium">昵称<input v-model.trim="name" class="input w-full" autocomplete="nickname" required></label>
              <label v-if="mode !== 'reset'" class="grid gap-1.5 text-sm font-medium">邮箱<input id="account-email" v-model.trim="email" type="email" class="input w-full" autocomplete="email" required></label>
              <label v-if="mode !== 'forgot'" class="grid gap-1.5 text-sm font-medium">密码<input id="account-password" v-model="password" type="password" class="input w-full" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required minlength="8"></label>
              <button id="account-submit" class="btn btn-primary mt-2" :disabled="busy">{{ { login: "登录", register: "注册", forgot: "发送重置邮件", reset: "保存密码" }[mode] }}</button>
            </form>
            <div class="flex flex-wrap gap-1">
              <button v-if="mode !== 'login'" class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="mode = 'login'">返回登录</button>
              <template v-else>
                <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="mode = 'register'">注册</button>
                <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="mode = 'forgot'">忘记密码</button>
                <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="run(resend)">重发验证邮件</button>
              </template>
            </div>
            <button v-if="mode === 'login' && config.googleClientId" class="btn btn-outline w-full" type="button" :disabled="busy" @click="run(google)">Google 登录</button>
          </template>
          <p v-if="notice" class="alert alert-info" role="status">{{ notice }}</p>
          <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>
        </div>
      </div>
    </div>
  </main>
</template>
