"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import {
  completeProfileDocumentUploadAction,
  createProfileDocumentAction,
  deleteProfileDocumentAction,
  startProfileDocumentUploadAction,
  updateProfileDocumentAction,
} from "./actions";
import type { ProfileDocument, ProfileDocumentInput } from "./types";

const invalidate = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.profileDocuments.all }),
    client.invalidateQueries({ queryKey: queryKeys.publicProfiles.all }),
  ]);

export function useProfileDocuments() {
  return useQuery({
    queryFn: () => fetchJson<ProfileDocument[]>("/api/profile-documents"),
    queryKey: queryKeys.profileDocuments.list(),
  });
}

export function useCreateProfileDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createProfileDocumentAction,
    onSuccess: (result) => (result.ok ? invalidate(client) : undefined),
  });
}

export function useUpdateProfileDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProfileDocumentInput }) => updateProfileDocumentAction(id, input),
    onSuccess: (result) => (result.ok ? invalidate(client) : undefined),
  });
}

export function useDeleteProfileDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteProfileDocumentAction,
    onSuccess: (result) => (result.ok ? invalidate(client) : undefined),
  });
}

export function useUploadProfileDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, id, onProgress }: { file: File; id: string; onProgress: (progress: number) => void }) =>
      uploadProfileDocument(id, file, onProgress),
    onSuccess: (result) => (result.ok ? invalidate(client) : undefined),
  });
}

async function uploadProfileDocument(id: string, file: File, onProgress: (progress: number) => void) {
  const started = await startProfileDocumentUploadAction(id, file.type, file.size);
  if (!started.ok) return started;

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", started.data.url);
    Object.entries(started.data.requiredHeaders).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The file upload failed. Try again."));
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error("The file upload failed. Try again."));
    request.send(file);
  });

  onProgress(100);
  return completeProfileDocumentUploadAction(id, started.data.fileKey, file.name);
}
