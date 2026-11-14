<script setup lang="ts">
import { Menu, Plus, X } from "@lucide/vue";
import { useMutationCache, useQuery, useQueryCache } from "@pinia/colada";
import { useMediaQuery, useOnline, useStorage } from "@vueuse/core";
import { storeToRefs } from "pinia";
import type { Account } from "~~/shared/types/library";
import { accountQueryKey, libraryKeys } from "~/utils/music-query-keys";

defineOptions({ name: "App" });

const { request } = useMusicApi();
const execute = useAccountActions();
const app = useAppStore();
const session = useSessionStore();
const library = useLibraryStore();
const libraryPlayer = usePlayerStore();
const queryCache = useQueryCache();
const mutationCache = useMutationCache();
const { drawerOpen, offline, native } = storeToRefs(app);
const theme = useStorage<"system" | "light" | "dark">("music-theme", "system", undefined, {
  initOnMounted: true,
  listenToStorageChanges: false,
  writeDefaults: false,
  serializer: {
    read: (value) => (value === "light" || value === "dark" ? value : "system"),
    write: (value) => value,
  },
});
const { account, userId } = storeToRefs(session);
const config = useRuntimeConfig().public;
const mode = ref<"login" | "register" | "forgot" | "reset">("login");
const email = ref("");
const name = ref("");
const password = ref("");
const resetToken = ref("");
const notice = ref("");
const error = ref("");
const accountFields = reactive({ name: "", email: "", password: "" });
const credentialsInvalid = ref(false);
const emailInput = useTemplateRef<HTMLInputElement>("emailInput");
const busy = ref(false);
const mounted = ref(false);
const signingOut = ref(false);
const player = useTemplateRef("player");
const profile = useTemplateRef("profile");
const drawerTrigger = useTemplateRef("drawerTrigger");
const drawerClose = useTemplateRef("drawerClose");
const route = useRoute();
const desktop = useMediaQuery("(min-width: 48rem)", { ssrWidth: 0 });
const online = useOnline();

const accountQuery = useQuery({
  key: accountQueryKey,
  enabled: () => mounted.value && !offline.value && !signingOut.value,
  refetchOnReconnect: false,
  query: async ({ signal }) => {
    try {
      return (await request<Account>("/api/account", { signal }))._data ?? null;
    } catch (cause) {
      if (
        typeof cause === "object" &&
        cause !== null &&
        "statusCode" in cause &&
        [401, 403].includes(Number(cause.statusCode))
      ) {
        return null;
      }
      throw cause;
    }
  },
});
const loading = computed(
  () => accountQuery.isPending.value || (accountQuery.isLoading.value && !account.value),
);
const accountError = computed(() =>
  accountQuery.error.value && !account.value ? "暂时无法连接音乐库。" : "",
);

useHead({
  htmlAttrs: {
    lang: "zh-CN",
    "data-theme": () => (theme.value === "system" ? undefined : theme.value),
  },
});

function bytes(size: number) {
  return size >= 1024 ** 3
    ? `${(size / 1024 ** 3).toFixed(2)} GiB`
    : `${(size / 1024 ** 2).toFixed(1)} MiB`;
}

function updateConnection(isOnline: boolean) {
  const wasOffline = offline.value;
  const nextOffline = !isOnline;
  if (nextOffline) queryCache.cancelQueries({ key: accountQueryKey });
  if (wasOffline && !nextOffline && !signingOut.value) void accountQuery.refetch();
  offline.value = nextOffline;
}

watch(online, (isOnline) => {
  if (mounted.value) updateConnection(isOnline);
});
watch(desktop, (matches) => {
  if (matches) drawerOpen.value = false;
});
watch(
  () => route.path,
  () => {
    drawerOpen.value = false;
  },
);
watch(
  drawerOpen,
  (open) => {
    if (open) drawerClose.value?.focus();
    else drawerTrigger.value?.focus();
  },
  { flush: "post" },
);
watch(
  userId,
  async (_, previousId) => {
    if (!previousId) return;
    const filters = { key: libraryKeys.user(previousId) };
    queryCache.cancelQueries(filters);
    for (const entry of mutationCache.getEntries(filters)) mutationCache.remove(entry);
    library.reset();
    drawerOpen.value = false;
    profile.value?.close();
    await nextTick();
    if (userId.value !== previousId) {
      for (const entry of queryCache.getEntries(filters)) queryCache.remove(entry);
    }
  },
  { flush: "sync" },
);
watch([userId, offline, () => accountQuery.isLoading.value], ([id, isOffline, checking]) => {
  if (config.integrationPlayback) return;
  if (!id || isOffline) void libraryPlayer.setOwner("");
  else if (!checking) void libraryPlayer.setOwner(id);
});
watch(mode, () => {
  clearAccountFields();
  error.value = "";
});

function clearCredentialsError() {
  if (!credentialsInvalid.value) return;
  credentialsInvalid.value = false;
  accountFields.password = "";
}

function clearAccountFields() {
  accountFields.name = "";
  accountFields.email = "";
  accountFields.password = "";
  credentialsInvalid.value = false;
}

function validateEmail() {
  accountFields.email = !email.value
    ? "请填写邮箱。"
    : emailInput.value?.validity.typeMismatch
      ? "请输入有效的邮箱地址。"
      : "";
  return !accountFields.email;
}

async function run(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  notice.value = "";
  error.value = "";
  clearAccountFields();
  try {
    await action();
  } catch (cause) {
    const data =
      typeof cause === "object" && cause !== null && "data" in cause ? cause.data : undefined;
    const code =
      typeof data === "object" && data !== null && "code" in data ? data.code : undefined;
    if (action === submit || action === resend) {
      switch (code) {
        case "INVALID_EMAIL":
          accountFields.email = "请输入有效的邮箱地址。";
          return;
        case "EMAIL_NOT_VERIFIED":
          accountFields.email = "请先验证邮箱。";
          return;
        case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
          accountFields.email = "该邮箱已注册。";
          return;
        case "INVALID_EMAIL_OR_PASSWORD":
          credentialsInvalid.value = true;
          accountFields.password = "邮箱或密码错误。";
          return;
        case "PASSWORD_TOO_SHORT":
          accountFields.password = "密码至少需要 8 个字符。";
          return;
        case "PASSWORD_TOO_LONG":
          accountFields.password = "密码最多允许 128 个字符。";
          return;
        case "INVALID_TOKEN":
          error.value = "重置链接无效或已过期，请重新发送重置邮件。";
          return;
      }
    }
    error.value = "操作失败，请检查网络和输入后重试。";
  } finally {
    busy.value = false;
  }
}

async function submit() {
  if (mode.value !== "reset") validateEmail();
  if (mode.value === "register" && !name.value) accountFields.name = "请填写昵称。";
  if (mode.value !== "forgot") {
    if (!password.value) accountFields.password = "请填写密码。";
    else if (password.value.length < 8) accountFields.password = "密码至少需要 8 个字符。";
    else if (mode.value !== "login" && password.value.length > 128)
      accountFields.password = "密码最多允许 128 个字符。";
  }
  if (accountFields.name || accountFields.email || accountFields.password) return;
  const submittedPassword = password.value;
  password.value = "";
  if (mode.value === "register") {
    await execute({
      type: "register",
      name: name.value,
      email: email.value,
      password: submittedPassword,
    });
    notice.value = "请查收验证邮件。";
    mode.value = "login";
  } else if (mode.value === "forgot") {
    await execute({ type: "forgot", email: email.value });
    notice.value = "如果该邮箱已注册，请查收重置邮件。";
  } else if (mode.value === "reset") {
    await execute({ type: "reset", token: resetToken.value, password: submittedPassword });
    resetToken.value = "";
    history.replaceState(null, "", "/");
    mode.value = "login";
    notice.value = "密码已重置，请登录。";
  } else {
    await execute({ type: "login", email: email.value, password: submittedPassword });
    await accountQuery.refetch(true);
  }
}

async function resend() {
  if (!validateEmail()) return;
  await execute({ type: "resend", email: email.value });
  notice.value = "请查收验证邮件。";
}

async function google() {
  await execute({ type: "google" });
  if (native.value) await accountQuery.refetch(true);
}

async function logout() {
  const id = userId.value;
  signingOut.value = true;
  queryCache.cancelQueries({ key: accountQueryKey });
  try {
    await execute({ type: "logout" });
    const release = player.value?.release();
    if (id) {
      try {
        localStorage.removeItem(`music-playback:${id}`);
      } catch {
        /* Storage may be unavailable. */
      }
    }
    queryCache.setQueryData(accountQueryKey, null);
    await Promise.allSettled([libraryPlayer.setOwner(""), release]);
    await navigateTo("/", { replace: true });
  } finally {
    signingOut.value = false;
  }
}

onMounted(() => {
  updateConnection(online.value);
  resetToken.value = new URLSearchParams(location.search).get("token") ?? "";
  if (resetToken.value) mode.value = "reset";
  mounted.value = true;
});

onBeforeUnmount(() => {
  void libraryPlayer.setOwner("");
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPwaManifest />
  <div
    v-if="account && !config.integrationPlayback"
    class="drawer app-height mx-auto max-w-[100rem] grid-rows-[minmax(0,1fr)] md:drawer-open"
    :class="{ 'select-none': native }"
  >
    <input
      id="music-drawer"
      v-model="drawerOpen"
      type="checkbox"
      class="drawer-toggle"
      tabindex="-1"
      aria-hidden="true"
    />
    <div class="drawer-content flex min-h-0 flex-col" :inert="drawerOpen">
      <header
        v-if="offline || route.path !== '/songs/new'"
        class="flex shrink-0 items-center gap-2 px-3 py-2 md:hidden"
      >
        <button
          ref="drawerTrigger"
          type="button"
          class="btn btn-ghost btn-square"
          aria-label="打开导航菜单"
          aria-controls="music-sidebar"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <Menu class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <span class="text-xl font-bold tracking-tight">inYue</span>
      </header>
      <main class="flex min-h-0 flex-1 flex-col">
        <p v-if="offline" class="alert alert-info alert-soft m-3" role="status">
          当前离线，连接网络后可访问音乐库。
        </p>
        <NuxtPage v-else :key="account.id" />
      </main>
    </div>
    <div
      class="drawer-side motion-safe:transition-opacity md:h-full"
      :inert="!desktop && !drawerOpen"
    >
      <label for="music-drawer" class="drawer-overlay md:hidden" aria-hidden="true" />
      <aside
        id="music-sidebar"
        class="flex h-full w-[min(18rem,85vw)] flex-col border-r border-base-300 bg-base-200 max-md:pt-[var(--safe-area-inset-top,env(safe-area-inset-top))] max-md:pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom))] max-md:pl-[var(--safe-area-inset-left,env(safe-area-inset-left))] md:w-56 lg:w-64"
        :role="drawerOpen ? 'dialog' : undefined"
        :aria-modal="drawerOpen ? true : undefined"
        aria-label="应用导航"
        @keydown.esc="drawerOpen = false"
      >
        <div class="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
          <NuxtLink
            to="/"
            class="flex min-h-10 items-center gap-2.5 rounded-field"
            aria-label="inYue 曲库"
            @click="drawerOpen = false"
          >
            <img src="/assets/icon/inyue.svg" width="36" height="36" class="shrink-0" alt="" />
            <span class="text-xl font-bold tracking-tight">inYue</span>
          </NuxtLink>
          <button
            ref="drawerClose"
            type="button"
            class="btn btn-ghost btn-square md:hidden"
            aria-label="关闭导航菜单"
            @click="drawerOpen = false"
          >
            <X class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
        <nav v-if="!offline" aria-label="曲库" class="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3">
          <NuxtLink
            to="/songs/new"
            class="btn btn-ghost shrink-0 justify-start gap-3 px-3 font-medium"
            active-class="bg-primary/10 text-primary"
            @click="drawerOpen = false"
          >
            <Plus class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true" /> 新增歌曲
          </NuxtLink>
          <div
            id="library-playlists"
            class="min-h-0 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-base-content/50 scrollbar-track-transparent"
          />
        </nav>
        <div class="mt-auto shrink-0 border-t border-base-300 p-3">
          <button
            type="button"
            class="btn btn-ghost h-auto min-h-11 w-full justify-start gap-3 px-2 py-1.5 text-left"
            aria-label="个人设置"
            aria-haspopup="dialog"
            @click="showMusicDialog(profile)"
          >
            <img
              v-if="account.image"
              :src="account.image"
              alt=""
              referrerpolicy="no-referrer"
              class="size-9 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              aria-hidden="true"
              class="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
              >{{ account.name.slice(0, 1) }}</span
            >
            <span class="min-w-0 truncate">{{ account.name }}</span>
          </button>
        </div>
      </aside>
    </div>
    <dialog
      ref="profile"
      class="modal modal-bottom sm:modal-middle"
      aria-labelledby="profile-title"
      @cancel="busy && $event.preventDefault()"
    >
      <div class="modal-box safe-panel grid gap-4">
        <div>
          <h2 id="profile-title" class="text-xl font-bold">{{ account.name }}</h2>
          <p class="mt-1 break-all text-sm text-base-content/70">{{ account.email }}</p>
        </div>
        <label class="grid gap-1.5 text-sm font-medium"
          >存储用量 {{ bytes(account.storage.usedBytes) }} / {{ bytes(account.storage.quotaBytes) }}
          <progress
            class="progress progress-primary w-full"
            :value="account.storage.usedBytes"
            :max="account.storage.quotaBytes"
          />
        </label>
        <label class="grid gap-1.5 text-sm font-medium"
          >主题
          <select v-model="theme" class="select w-full">
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
        <p v-if="error || accountError" class="alert alert-error" role="alert">
          {{ error || accountError }}
        </p>
        <div class="flex justify-end gap-2">
          <form method="dialog"><button class="btn btn-ghost" :disabled="busy">关闭</button></form>
          <button class="btn btn-error btn-outline" :disabled="busy" @click="run(logout)">
            退出登录
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button tabindex="-1" :disabled="busy">关闭账户弹窗</button>
      </form>
    </dialog>
  </div>
  <main
    v-else
    class="app-height grid overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(26rem,0.8fr)]"
    :class="{ 'select-none': native }"
  >
    <div
      class="hidden place-items-center overflow-hidden bg-neutral p-10 text-neutral-content md:grid"
      aria-hidden="true"
    >
      <MusicArtwork class="w-full max-w-md rotate-[-8deg] shadow-2xl" />
    </div>
    <div class="grid content-center justify-items-center px-5 py-8">
      <div class="card w-full max-w-sm">
        <div class="card-body gap-4 p-2 sm:p-4">
          <header class="mb-4 flex items-center gap-3">
            <img src="/assets/icon/inyue.svg" width="44" height="44" class="shrink-0" alt="" />
            <h1 class="text-3xl font-bold tracking-tight">inYue</h1>
          </header>
          <p v-if="offline" role="status">当前离线，连接网络后可访问音乐库。</p>
          <p
            v-else-if="loading"
            role="status"
            class="flex items-center gap-2 text-sm text-base-content/65"
          >
            <span class="loading loading-spinner loading-xs" aria-hidden="true" /> 正在检查会话…
          </p>
          <template v-else-if="account">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="card-title">{{ account.name }}</h2>
                <p class="break-all text-sm">{{ account.email }}</p>
              </div>
              <button class="btn btn-sm" type="button" :disabled="busy" @click="run(logout)">
                退出登录
              </button>
            </div>
            <IntegrationPlayer v-if="config.integrationPlayback" ref="player" />
          </template>
          <template v-else>
            <h2
              v-if="mode === 'forgot' || mode === 'reset'"
              class="text-2xl font-bold tracking-tight"
            >
              {{ mode === "forgot" ? "找回密码" : "重置密码" }}
            </h2>
            <form class="grid gap-3" novalidate @submit.prevent="run(submit)">
              <div v-if="mode === 'register'" class="grid gap-1.5 text-sm">
                <label for="account-name" class="font-medium">昵称</label>
                <input
                  id="account-name"
                  v-model.trim="name"
                  class="input validator w-full"
                  autocomplete="nickname"
                  required
                  :disabled="busy"
                  :aria-invalid="!!accountFields.name"
                  :aria-describedby="accountFields.name ? 'account-name-error' : undefined"
                  @input="accountFields.name = ''"
                />
                <p
                  v-if="accountFields.name"
                  id="account-name-error"
                  class="validator-hint mt-0"
                  role="alert"
                >
                  {{ accountFields.name }}
                </p>
              </div>
              <div v-if="mode !== 'reset'" class="grid gap-1.5 text-sm">
                <label for="account-email" class="font-medium">邮箱</label>
                <input
                  id="account-email"
                  ref="emailInput"
                  v-model.trim="email"
                  type="email"
                  class="input validator w-full"
                  autocomplete="email"
                  required
                  :disabled="busy"
                  :aria-invalid="!!accountFields.email || credentialsInvalid"
                  :aria-describedby="
                    accountFields.email
                      ? 'account-email-error'
                      : credentialsInvalid
                        ? 'account-password-error'
                        : undefined
                  "
                  @input="
                    accountFields.email = '';
                    clearCredentialsError();
                  "
                />
                <p
                  v-if="accountFields.email"
                  id="account-email-error"
                  class="validator-hint mt-0"
                  role="alert"
                >
                  {{ accountFields.email }}
                </p>
              </div>
              <div v-if="mode !== 'forgot'" class="grid gap-1.5 text-sm">
                <label for="account-password" class="font-medium">密码</label>
                <input
                  id="account-password"
                  v-model="password"
                  type="password"
                  class="input validator w-full"
                  :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                  required
                  minlength="8"
                  :disabled="busy"
                  :aria-invalid="!!accountFields.password"
                  :aria-describedby="accountFields.password ? 'account-password-error' : undefined"
                  @input="
                    accountFields.password = '';
                    clearCredentialsError();
                  "
                />
                <p
                  v-if="accountFields.password"
                  id="account-password-error"
                  class="validator-hint mt-0"
                  role="alert"
                >
                  {{ accountFields.password }}
                </p>
              </div>
              <button id="account-submit" class="btn btn-primary mt-2" :disabled="busy">
                {{
                  { login: "登录", register: "注册", forgot: "发送重置邮件", reset: "保存密码" }[
                    mode
                  ]
                }}
              </button>
            </form>
            <div class="flex flex-wrap gap-1">
              <button
                v-if="mode !== 'login'"
                class="btn btn-ghost btn-sm"
                type="button"
                :disabled="busy"
                @click="mode = 'login'"
              >
                返回登录
              </button>
              <template v-else>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  :disabled="busy"
                  @click="mode = 'register'"
                >
                  注册
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  :disabled="busy"
                  @click="mode = 'forgot'"
                >
                  忘记密码
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  :disabled="busy"
                  @click="run(resend)"
                >
                  重发验证邮件
                </button>
              </template>
            </div>
            <button
              v-if="mode === 'login' && config.googleClientId"
              class="btn btn-outline w-full"
              type="button"
              :disabled="busy"
              @click="run(google)"
            >
              Google 登录
            </button>
          </template>
          <p v-if="notice" class="alert alert-info" role="status">{{ notice }}</p>
          <p v-if="error || accountError" class="alert alert-error" role="alert">
            {{ error || accountError }}
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
