import "server-only";

import { getServerAuthContext } from "./auth-context";
import { getValidAccessToken } from "./token-refresh";

type QueryValue = boolean | number | string | null | undefined;

type ApiQuery = Record<string, QueryValue | QueryValue[]>;

type NextFetchOptions = {
  revalidate?: false | number;
  tags?: string[];
};

type ApiRequestOptions = {
  auth?: boolean;
  cache?: RequestCache;
  headers?: HeadersInit;
  timeoutMs?: number;
  next?: NextFetchOptions;
  query?: ApiQuery;
};

const DEFAULT_API_TIMEOUT_MS = 15_000;

type ApiResponseEnvelope<Data = unknown> = {
  data: Data;
  message?: unknown;
  meta?: unknown;
  statusCode?: unknown;
  success?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL is not configured. Set it before connecting backend API calls.");
  }

  return baseUrl;
}

function appendQuery(url: URL, query?: ApiQuery) {
  if (!query) return;

  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined) url.searchParams.append(key, String(item));
      });
      return;
    }

    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  });
}

function baseUrlWithTrailingSlash(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function relativeApiPath(path: string) {
  return path.replace(/^\/+/, "");
}

function buildUrl(path: string, query?: ApiQuery) {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(relativeApiPath(path), baseUrlWithTrailingSlash(getApiBaseUrl()));

  appendQuery(url, query);
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiResponseEnvelope(value: unknown): value is ApiResponseEnvelope {
  return (
    isRecord(value) &&
    "data" in value &&
    "success" in value &&
    "statusCode" in value &&
    "message" in value
  );
}

function readErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "string" && payload) return payload;

  if (isRecord(payload)) {
    const message = payload.message;

    if (typeof message === "string" && message) return message;
    if (Array.isArray(message) && message.length > 0) return message.map(String).join(" ");
  }

  return `Request failed with status ${status}`;
}

function unwrapPayload<Data>(payload: unknown): Data {
  return (isApiResponseEnvelope(payload) ? payload.data : payload) as Data;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204) return undefined;
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

async function request<Data>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<Data> {
  const authContext = options.auth === false ? null : await getServerAuthContext();
  const accessToken = options.auth === false ? null : await getValidAccessToken(authContext);

  const response = await fetch(buildUrl(path, options.query), {
    ...init,
    cache: options.cache,
    headers: {
      Accept: "application/json",
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
      ...init.headers,
    },
    next: options.next,
    signal: init.signal ?? AbortSignal.timeout(options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS),
  } as RequestInit & { next?: NextFetchOptions });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload, response.status), response.status, payload);
  }

  return unwrapPayload<Data>(payload);
}

function bodyInit(body?: unknown) {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

export const api = {
  delete: <Data>(path: string, options?: ApiRequestOptions) =>
    request<Data>(path, { method: "DELETE" }, options),

  get: <Data>(path: string, options?: ApiRequestOptions) =>
    request<Data>(path, { method: "GET" }, options),

  patch: <Data>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<Data>(path, { body: bodyInit(body), method: "PATCH" }, options),

  post: <Data>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<Data>(path, { body: bodyInit(body), method: "POST" }, options),

  put: <Data>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<Data>(path, { body: bodyInit(body), method: "PUT" }, options),
};
