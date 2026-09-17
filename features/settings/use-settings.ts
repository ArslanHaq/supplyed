"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import { startRouteLoading } from "@/lib/navigation-loading";

import { updateSettingsAction, uploadSettingsProfileImageAction } from "./actions";
import type { SettingsProfileSnapshot, SettingsUpdateInput } from "./types";

type UpdateSettingsResult = Awaited<ReturnType<typeof updateSettingsAction>>;
type UploadSettingsProfileImageResult = Awaited<ReturnType<typeof uploadSettingsProfileImageAction>>;

type UseUpdateSettingsOptions = {
  onError?: () => void;
  onSuccess?: (result: UpdateSettingsResult) => void | Promise<void>;
};

type UseUploadSettingsProfileImageOptions = {
  onError?: () => void;
  onSuccess?: (result: UploadSettingsProfileImageResult) => void | Promise<void>;
};

function snapshotWithProfileImage(snapshot: SettingsProfileSnapshot, imageUrl: string | null): SettingsProfileSnapshot {
  if (snapshot.role === "teacher" && snapshot.instructor) {
    return { ...snapshot, instructor: { ...snapshot.instructor, imageUrl: imageUrl ?? "" } };
  }

  if (snapshot.role === "institution" && snapshot.institution) {
    return { ...snapshot, institution: { ...snapshot.institution, imageUrl: imageUrl ?? "" } };
  }

  if (snapshot.role === "individual" && snapshot.recruiter) {
    return { ...snapshot, recruiter: { ...snapshot.recruiter, imageUrl: imageUrl ?? "" } };
  }

  return snapshot;
}

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
export function useUploadSettingsProfileImage(options: UseUploadSettingsProfileImageOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.set("file", file, file.name);
      return uploadSettingsProfileImageAction(formData);
    },
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && result.code === "SESSION_EXPIRED") {
        signOutExpiredSession();
        return;
      }

      if (result.ok) {
        queryClient.setQueryData<SettingsProfileSnapshot>(queryKeys.settings.profile(), (current) =>
          current ? snapshotWithProfileImage(current, result.data.imageUrl) : current,
        );
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
