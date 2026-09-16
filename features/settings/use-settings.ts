"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import { startRouteLoading } from "@/lib/navigation-loading";

import { updateSettingsAction } from "./actions";
import type { SettingsProfileSnapshot, SettingsUpdateInput } from "./types";

type UpdateSettingsResult = Awaited<ReturnType<typeof updateSettingsAction>>;

type UseUpdateSettingsOptions = {
  onError?: () => void;
  onSuccess?: (result: UpdateSettingsResult) => void | Promise<void>;
};

function signOutExpiredSession() {
  startRouteLoading();
  void signOut({ redirect: false }).finally(() => {
    window.location.assign("/login");
  });
}

export function useSettingsProfile() {
  return useQuery({
    queryFn: () => fetchJson<SettingsProfileSnapshot>("/api/settings/profile"),
    queryKey: queryKeys.settings.profile(),
  });
}

export function useUpdateSettings(options: UseUpdateSettingsOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SettingsUpdateInput) => updateSettingsAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && result.code === "SESSION_EXPIRED") {
        signOutExpiredSession();
        return;
      }

      if (result.ok) {
        queryClient.setQueryData(queryKeys.settings.profile(), result.data);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
        ]);
      }

      await options.onSuccess?.(result);
    },
  });
}
