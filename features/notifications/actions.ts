"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeNotification, normalizePreferences } from "./schemas";
import type { NotificationPreferences } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markNotificationReadAction(id: string) {
  if (!UUID.test(id)) return actionError("Choose a valid notification.");

  try {
    return actionOk(normalizeNotification(await api.post<unknown>(`/notifications/${id}/read`)));
  } catch (error) {
    return actionError(readError(error, "The notification could not be updated."));
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const result = await api.post<{ updated?: number }>("/notifications/read-all");
    return actionOk({ updated: Number(result?.updated ?? 0) });
  } catch (error) {
    return actionError(readError(error, "Notifications could not be updated."));
  }
}

export async function updateNotificationPreferencesAction(input: Partial<NotificationPreferences>) {
  const body = Object.fromEntries(Object.entries(input).filter(([, value]) => typeof value === "boolean"));

  try {
    return actionOk(normalizePreferences(await api.patch<unknown>("/notifications/preferences", body)), "Email settings saved.");
  } catch (error) {
    return actionError(readError(error, "Your email settings could not be saved."));
  }
}

function readError(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}
