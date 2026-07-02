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
  next?: NextFetchOptions;
  query?: ApiQuery;
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

function buildUrl(path: string, query?: ApiQuery) {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(path.startsWith("/") ? path : `/${path}`, getApiBaseUrl());

  appendQuery(url, query);
  return url.toString();
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
  } as RequestInit & { next?: NextFetchOptions });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      typeof payload === "string" && payload ? payload : `Request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as Data;
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
