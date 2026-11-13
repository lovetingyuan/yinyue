import { useQueryState } from "@pinia/colada";
import { defineStore } from "pinia";
import type { Account } from "~~/shared/types/library";
import { accountQueryKey } from "~/utils/music-query-keys";

export const useSessionStore = defineStore("session", () => {
  const { data } = useQueryState<Account | null>(accountQueryKey);
  const account = computed(() => data.value ?? null);
  const userId = computed(() => account.value?.id ?? "");
  const generation = ref(0);
  watch(userId, () => { generation.value++; }, { flush: "sync" });

  return { account, userId, generation };
});
