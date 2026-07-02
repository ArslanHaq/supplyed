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
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<Data>;
}
