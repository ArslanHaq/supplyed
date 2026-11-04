"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { normalizeProfileDocument } from "./schemas";
import type { ProfileDocument, ProfileDocumentInput, ProfileDocumentUpload } from "./types";

function failure(error: unknown, fallback: string) {
  return error instanceof ApiError
    ? actionError(error.message, { code: error.code, requestId: error.requestId, status: error.status })
    : actionError(fallback);
}

function clean(input: ProfileDocumentInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    issueDate: input.issueDate || undefined,
  };
}

export async function createProfileDocumentAction(input: ProfileDocumentInput) {
  if (!input.title.trim()) return actionError("Enter a title.");
  try {
    return actionOk(normalizeProfileDocument(await api.post<ProfileDocument>("/profile-documents", clean(input))));
  } catch (error) {
    return failure(error, "The profile document could not be created.");
  }
}

export async function updateProfileDocumentAction(id: string, input: ProfileDocumentInput) {
  if (!id || !input.title.trim()) return actionError("Enter a title.");
  try {
    return actionOk(normalizeProfileDocument(await api.patch<ProfileDocument>(`/profile-documents/${id}`, clean(input))));
  } catch (error) {
    return failure(error, "The profile document could not be updated.");
  }
}

export async function deleteProfileDocumentAction(id: string) {
  try {
    await api.delete(`/profile-documents/${id}`);
    return actionOk({ id });
  } catch (error) {
    return failure(error, "The profile document could not be deleted.");
  }
}

export async function startProfileDocumentUploadAction(id: string, contentType: string, sizeBytes: number) {
  try {
    return actionOk(
      await api.post<ProfileDocumentUpload>(`/profile-documents/${id}/upload-url`, { contentType, sizeBytes }),
    );
  } catch (error) {
    return failure(error, "The upload could not be started.");
  }
}

export async function completeProfileDocumentUploadAction(id: string, fileKey: string, originalName: string) {
  try {
    return actionOk(
      normalizeProfileDocument(
        await api.post<ProfileDocument>(`/profile-documents/${id}/upload-complete`, { fileKey, originalName }),
      ),
    );
  } catch (error) {
    return failure(error, "The uploaded file could not be saved.");
  }
}
