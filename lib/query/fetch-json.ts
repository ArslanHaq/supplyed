import { signOut } from "next-auth/react";

import { startRouteLoading } from "@/lib/navigation-loading";

type QueryValue = boolean | number | string | null | undefined;

type FetchJsonOptions = {
  query?: Record<string, QueryValue>;
};

function withQuery(path: string, query?: FetchJsonOptions["query"]) {
  const url = new URL(path, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}`;
}

export async function fetchJson<Data>(path: string, options: FetchJsonOptions = {}): Promise<Data> {
  const response = await fetch(withQuery(path, options.query), {
    credentials: "same-origin",
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const message = readErrorMessage(payload, `Request failed with status ${response.status}`);
    const code = readErrorCode(payload);

    if (response.status === 401 || code === "SESSION_EXPIRED") {
      startRouteLoading();
      void signOut({ redirect: false }).finally(() => {
        window.location.assign("/login");
      });
    }

    throw new Error(message);
  }

  return response.json() as Promise<Data>;
}

async function readErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;

  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readErrorCode(payload: unknown): string | undefined {
  if (isRecord(payload) && typeof payload.code === "string" && payload.code.trim()) return payload.code;
  return undefined;
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.message === "string" && payload.message.trim()) return payload.message;
  return fallback;
}
