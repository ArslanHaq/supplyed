const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

// Real modules, isolated network/auth. No credentials, emails, provider calls or real writes.
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    const absolute = path.resolve(__dirname, "..", filename);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loadedModule = { exports: {} };
    cache.set(absolute, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const requireModule = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === "server-only") return {};
      if (id.startsWith("@/") || id.startsWith(".")) {
        const target = id.startsWith("@/") ? path.resolve(__dirname, "..", id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load([target, `${target}.ts`, `${target}.tsx`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile()));
      }
      if (id === "libphonenumber-js/max") { const lib = require(id); return { ...lib, parsePhoneNumberFromString: (value, options) => lib.parsePhoneNumberFromString(value, { ...options }) }; }
      return require(id);
    };
    vm.runInNewContext(source, {
      module: loadedModule, exports: loadedModule.exports, require: requireModule,
      Buffer, URL, Request, Response, Headers, FormData, File, Blob, AbortSignal,
      TransformStream, ReadableStream, Uint8Array, Error, TypeError, Date, console, setTimeout, clearTimeout,
      process: { env: { NODE_ENV: "test", API_BASE_URL: "https://backend.example/api" } },
      ...globals,
    }, { filename: absolute });
    return loadedModule.exports;
  }
  return load;
}

function uploadRequest(file, extra = {}) {
  const form = new FormData();
  form.set("file", file);
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return new Request("https://app.example/api/upload", { method: "POST", body: form, headers: { Origin: "https://app.example" } });
}

test("malformed Unicode entities cannot crash proposal validation or rendering", () => {
  const { richTextToPlainText } = loader()("features/applications/rich-text.ts");
  for (const value of ["&#x110000;", "&#999999999;", "&#xD800;"]) assert.equal(richTextToPlainText(value), value);
  assert.equal(richTextToPlainText("<p>A &#65; &#x1F600;</p>"), "A A 😀");
});

test("production refuses missing backend configuration; development fixtures remain available", async () => {
  for (const value of [undefined, "", "   ", "file:///tmp/backend"]) {
    const load = loader({ "@/lib/server/api-client": { api: {} } }, { process: { env: { NODE_ENV: "production", API_BASE_URL: value } } });
    await assert.rejects(() => load("features/auth/backend.ts").loginWithEmail({ email: "test@example.com", password: "any-password" }));
  }
  const enabled = loader({}, { process: { env: { NODE_ENV: "development" } } })("lib/server/backend-config.ts");
  assert.equal(enabled.backendEnabled(), false);
});

function refreshFixture(response, update = async () => {}) {
  const calls = [], updates = [];
  const load = loader({ "@/auth": { updateAuthSession: async (data) => { updates.push(data); await update(data); } } }, {
    fetch: async (url, init) => { calls.push({ url, init }); return typeof response === "function" ? response() : response; },
  });
  return { refresh: load("lib/server/token-refresh.ts"), calls, updates };
}
function token(sub = "user-1") { return `header.${Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`; }

test("parallel refreshes share one request but each caller persists the rotated credentials", async () => {
  const f = refreshFixture(() => Response.json({ accessToken: token(), refreshToken: "rotated" }));
  const values = await Promise.all(Array.from({ length: 8 }, () => f.refresh.refreshBackendAccessToken("same-refresh")));
  assert.equal(f.calls.length, 1);
  assert.equal(f.updates.length, 8);
  assert.ok(f.calls[0].init.signal instanceof AbortSignal);
  assert.ok(values.every((value) => value.refreshToken === "rotated"));
  await f.refresh.refreshBackendAccessToken("same-refresh");
  assert.equal(f.calls.length, 1);
  await f.refresh.refreshBackendAccessToken("different-user-refresh");
  assert.equal(f.calls.length, 2);
});

test("a render-only cookie context does not lose the rotated pair for the next writable request", async () => {
  let writable = false;
  const f = refreshFixture(() => Response.json({ accessToken: token(), refreshToken: "rotated" }), async () => {
    if (!writable) throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
  });
  await f.refresh.refreshBackendAccessToken("render-token");
  writable = true;
  await f.refresh.refreshBackendAccessToken("render-token");
  assert.equal(f.calls.length, 1);
  assert.equal(f.updates[1].backendAuthUpdate.refreshToken, "rotated");
});

test("transient and malformed refresh responses preserve the session and can be retried", async () => {
  for (const status of [400, 429, 500, 503]) {
    const f = refreshFixture(() => new Response("unavailable", { status }));
    await assert.rejects(() => f.refresh.refreshBackendAccessToken("token"), (error) => error.status === 503);
    await assert.rejects(() => f.refresh.refreshBackendAccessToken("token"));
    assert.equal(f.updates.length, 0);
    assert.equal(f.calls.length, 2);
  }
  for (const body of ["not-json", "{}", "null"]) {
    const f = refreshFixture(() => new Response(body));
    await assert.rejects(() => f.refresh.refreshBackendAccessToken("token"), (error) => error.status === 502);
    assert.equal(f.updates.length, 0);
  }
  const f = refreshFixture(() => { throw new TypeError("network failure"); });
  await assert.rejects(() => f.refresh.refreshBackendAccessToken("token"));
  assert.equal(f.updates.length, 0);
});

test("definitive authentication rejection still expires a session", async () => {
  for (const status of [401, 403]) {
    const f = refreshFixture(() => new Response(null, { status }));
    assert.equal(await f.refresh.refreshBackendAccessToken("invalid-token"), null);
    assert.equal(f.updates[0].backendAuthUpdate.type, "expired");
  }
});

test("bounded multipart parsing preserves full-size valid bytes and document fields", async () => {
  const { readLimitedFormData } = loader()("lib/server/upload-request.ts");
  const bytes = Buffer.alloc(10 * 1024 * 1024, 65);
  const form = await readLimitedFormData(uploadRequest(new File([bytes], "certificate.pdf", { type: "application/pdf" }), { requirementId: "req-1" }), bytes.length);
  assert.equal(form.get("requirementId"), "req-1");
  assert.deepEqual(Buffer.from(await form.get("file").arrayBuffer()), bytes);
});

test("multipart limits reject lying content lengths, extra files, and malformed origins", async () => {
  const { readLimitedFormData, requireSameOrigin } = loader()("lib/server/upload-request.ts");
  const encoded = uploadRequest(new File([Buffer.alloc(100_000)], "large.pdf", { type: "application/pdf" }));
  // Model incoming HTTP bytes, rather than undici's outgoing multipart encoder.
  const request = new Request(encoded.url, { method: "POST", headers: encoded.headers, body: await encoded.arrayBuffer() });
  request.headers.set("Content-Length", "1");
  await assert.rejects(() => readLimitedFormData(request, 100), (error) => error.status === 413);
  await assert.rejects(() => readLimitedFormData(uploadRequest(new File(["a"], "one.pdf"), { extra: new File(["b"], "two.pdf") }), 1024), (error) => error.status === 400);
  for (const origin of ["null", "not-a-url", "https://attacker.example"]) {
    assert.throws(() => requireSameOrigin(new Request("https://app.example/upload", { headers: { Origin: origin } })), (error) => error.status === 403);
  }
});

test("anonymous conversation uploads are rejected before multipart parsing", async () => {
  const route = loader({ "@/lib/server/auth-context": { getServerAuthContext: async () => null } })("app/api/conversations/[id]/attachments/route.ts");
  const request = uploadRequest(new File(["content"], "file.pdf", { type: "application/pdf" }));
  assert.equal((await route.POST(request, { params: Promise.resolve({ id: "c-1" }) })).status, 401);
  assert.equal(request.bodyUsed, false);
});

test("every supported conversation attachment uploads unchanged with a deadline", async () => {
  const types = loader()("features/conversations/schemas.ts").ALLOWED_ATTACHMENT_TYPES;
  for (const type of types) {
    const calls = [];
    const load = loader({
      "@/lib/server/auth-context": { getServerAuthContext: async () => ({ userId: "user-1" }) },
      "@/lib/server/api-client": { api: { post: async (url, body) => {
        calls.push({ url, body });
        return { upload: { url: "https://storage.example/upload", requiredHeaders: { "Content-Type": type } }, attachment: { id: "a-1" } };
      } } },
    }, { fetch: async (_url, init) => { assert.equal(await init.body.text(), "file bytes"); assert.ok(init.signal); return new Response(null, { status: 200 }); } });
    const response = await load("app/api/conversations/[id]/attachments/route.ts").POST(
      uploadRequest(new File(["file bytes"], "file", { type })), { params: Promise.resolve({ id: "c-1" }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, "a-1");
    assert.equal(calls[0].body.contentType, type);
  }
});

test("onboarding upload route honors live backend limits even when the session role is stale", async () => {
  let uploaded;
  const load = loader({
    "@/auth": { auth: async () => ({ user: { isEmailVerified: true, role: null } }) },
    "@/features/auth/queries": { getCurrentUser: async () => ({ role: "teacher" }) },
    "@/features/onboarding/documents": { getProfileDocumentRequirements: async (role) => { assert.equal(role, "teacher"); return [{ maxSizeBytes: 12 * 1024 * 1024 }]; } },
    "@/features/onboarding/actions": { uploadOnboardingDocumentAction: async (form) => { uploaded = form.get("file"); return { ok: true }; } },
  });
  const size = 11 * 1024 * 1024;
  const response = await load("app/api/onboarding/documents/route.ts").POST(uploadRequest(new File([Buffer.alloc(size)], "certificate.pdf", { type: "application/pdf" })));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(uploaded.size, size);
});

test("onboarding previews preserve PDF/images and force unsafe content to a sandboxed download", async () => {
  for (const type of ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/html", "image/svg+xml", "application/msword"]) {
    const load = loader({ "@/lib/server/api-client": { api: { get: async () => ({ downloadUrl: "https://storage.example/file" }) } } }, {
      fetch: async (_url, init) => { assert.ok(init.signal); return new Response("file bytes", { headers: { "Content-Type": type } }); },
    });
    const response = await load("app/api/onboarding/documents/[documentId]/preview/route.ts").GET(new Request("https://app.example/preview?name=file.pdf"), { params: Promise.resolve({ documentId: "doc-1" }) });
    const safe = !["text/html", "image/svg+xml", "application/msword"].includes(type);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Disposition"), safe ? /^inline/ : /^attachment/);
    assert.equal(response.headers.get("Content-Type"), safe ? type : "application/octet-stream");
    assert.equal(response.headers.get("Content-Security-Policy"), "sandbox");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(await response.text(), "file bytes");
  }
});

test("document upload creates, transfers, completes and replaces existing documents without changing bytes", async () => {
  for (const replace of [false, true]) {
    const calls = [];
    const load = loader({ "@/lib/server/api-client": { api: {
      get: async () => replace ? [{ id: "doc-1", requirementId: "req-1", fileKey: "old" }] : [],
      post: async (url, body) => {
        calls.push({ url, body });
        if (url.endsWith("upload-url")) return { url: "https://storage.example/upload", fileKey: "new-key", requiredHeaders: { "x-signed-header": "preserve" } };
        return { id: "doc-1", requirementId: "req-1", fileKey: "new-key", originalName: "certificate.pdf", uploadedAt: "2026-10-14T00:00:00Z", contentType: "application/pdf", status: "PENDING" };
      },
    } } }, { fetch: async (_url, init) => { assert.equal(await init.body.text(), "PDF bytes"); assert.equal(init.headers["x-signed-header"], "preserve"); assert.ok(init.signal); return new Response(null); } });
    const result = await load("features/onboarding/documents.ts").uploadProfileDocument({ auth: {}, file: new File(["PDF bytes"], "certificate.pdf", { type: "application/pdf" }), requirement: { id: "req-1", name: "Certificate", allowedMimes: ["application/pdf"], maxSizeBytes: 10 * 1024 * 1024 } });
    assert.equal(result.id, "doc-1");
    assert.equal(calls.some((call) => call.url === "/documents"), !replace);
    assert.equal(calls.at(-1).url, "/documents/doc-1/upload-complete");
    assert.equal(calls.at(-1).body.fileKey, "new-key");
  }
});

test("profile photo uploads accept the advertised 5 MiB and complete only after storage succeeds", async () => {
  for (const status of [200, 503]) {
    const calls = [];
    const load = loader({
      "next/cache": { revalidateTag: () => {} },
      "./queries": {},
      "@/lib/server/auth-context": { getServerAuthContext: async () => ({ userId: "user-1" }) },
      "@/lib/server/api-client": { ApiError: class extends Error {}, api: { post: async (url) => {
        calls.push(url); return url.endsWith("upload-url") ? { url: "https://storage.example/upload", fileKey: "photo" } : { imageUrl: "https://storage.example/photo" };
      } } },
    }, { fetch: async (_url, init) => { assert.equal(init.body.size, 5 * 1024 * 1024); assert.ok(init.signal); return new Response(null, { status }); } });
    const form = new FormData(); form.set("file", new File([Buffer.alloc(5 * 1024 * 1024)], "photo.png", { type: "image/png" }));
    const result = await load("features/settings/actions.ts").uploadSettingsProfileImageAction(form);
    assert.equal(result.ok, status === 200);
    assert.equal(calls.some((url) => url.endsWith("upload-complete")), status === 200);
  }
});

test("settings validate before any write and report partial backend failures without claiming success", async () => {
  for (const scenario of ["invalid-rate", "invalid-name", "missing-profile", "partial", "success"]) {
    const calls = [];
    const load = loader({
      "next/cache": { revalidateTag: () => {} },
      "./queries": { getSettingsProfileSnapshot: async () => ({ user: { name: "Teacher" }, instructor: scenario === "missing-profile" ? null : { id: "profile-1" } }) },
      "@/lib/server/auth-context": { getServerAuthContext: async () => ({ userId: "user-1", role: "teacher" }) },
      "@/lib/server/api-client": { ApiError: class extends Error {}, api: { patch: async (url, body) => {
        calls.push({ url, body }); if (scenario === "partial" && calls.length === 2) throw new Error("backend unavailable");
      } } },
    });
    const input = { role: "teacher", user: { name: scenario === "invalid-name" ? 42 : "Teacher" }, instructor: { fullName: "Teacher", countryCode: "GB", subjects: [], keyStages: [], skills: [], dailyRate: scenario === "invalid-rate" ? "invalid" : "200" } };
    const result = await load("features/settings/actions.ts").updateSettingsAction(input);
    assert.equal(result.ok, scenario === "success");
    assert.equal(calls.length, ["success", "partial"].includes(scenario) ? 2 : 0);
    if (scenario === "partial") assert.equal(result.code, "SETTINGS_PARTIAL_SAVE");
    if (scenario === "success") { assert.equal(calls[0].url, "/users/me"); assert.equal(calls[1].body.dailyRate, 200); }
  }
});

test("draft creation and publication retain their backend sequence and return the created job", async () => {
  for (const status of ["DRAFT", "ACTIVE"]) {
    const calls = [];
    const job = { id: "job-1", title: "Teacher", description: "Teach mathematics to a welcoming primary class.", keyStages: ["KS2"], status: "DRAFT" };
    const load = loader({ "next/cache": { revalidateTag: () => {} }, "@/lib/server/api-client": { ApiError: class extends Error {}, api: {
      post: async (url, body) => { calls.push({ url, body }); return job; },
      patch: async (url, body) => { calls.push({ url, body }); return { ...job, ...body }; },
    } } });
    const result = await load("features/jobs/actions.ts").createJobAction({ ...job, status });
    assert.equal(result.ok, true); assert.equal(result.data.status, status); assert.equal(result.data.id, "job-1");
    assert.equal(calls.length, status === "ACTIVE" ? 2 : 1);
    assert.equal(calls[0].url, "/jobs"); assert.equal(calls[0].body.status, undefined);
  }
});

test("interrupted publication retains the job ID for a safe update retry", async () => {
  let created = 0, fail = true;
  const job = { id: "job-1", title: "Teacher", description: "Teach mathematics to a welcoming primary class.", keyStages: [], status: "DRAFT" };
  const load = loader({ "next/cache": { revalidateTag: () => {} }, "@/lib/server/api-client": { ApiError: class extends Error {}, api: {
    get: async (url) => { assert.equal(url, "/jobs/mine/job-1"); return job; },
    post: async () => { created++; return job; },
    patch: async (url, body) => { assert.equal(url, "/jobs/job-1"); if (fail) throw new Error("unavailable"); return { ...job, ...body }; },
  } } });
  const actions = load("features/jobs/actions.ts");
  const partial = await actions.createJobAction({ ...job, status: "ACTIVE" });
  assert.equal(partial.ok, false); assert.equal(partial.savedJobId, "job-1");
  fail = false;
  const result = await actions.updateJobAction({ ...job, id: partial.savedJobId, status: "ACTIVE" });
  assert.equal(result.ok, true); assert.equal(result.data.status, "ACTIVE"); assert.equal(created, 1);
  assert.equal((await actions.createJobAction(null)).ok, false);
});

test("the four-step job form blocks double submission and retries the saved job without changing navigation", async () => {
  const slots = [], created = [], updated = [], navigated = [];
  let index = 0, createOptions, updateOptions;
  const useState = (initial) => {
    const slot = index++;
    if (!Object.hasOwn(slots, slot)) slots[slot] = typeof initial === "function" ? initial() : initial;
    return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
  };
  const load = loader({
    react: { ...require("react"), useState, useRef: (initial) => useState({ current: initial })[0] },
    "@/features/jobs/use-jobs": {
      useJob: () => ({}),
      useCreateJob: (options) => { createOptions = options; return { isPending: false, mutate: (input) => created.push(input) }; },
      useUpdateJob: (options) => { updateOptions = options; return { isPending: false, mutate: (input) => updated.push(input) }; },
    },
    "../atoms": { Btn: "Btn", Checkbox: "Checkbox", Field: "Field", Tag: "Tag" },
    "../molecules": { FormattedJobDescription: "Description", PageHead: "Head", PostcodeLookup: "Postcode", TagInput: "Tags" },
    "../molecules/OptionDropdowns": { MultiSelectDropdown: "MultiSelect", SelectDropdown: "Select" },
  });
  const editor = load("components/organisms/PostJobPage.tsx").PostJobPage({ ctx: {}, role: "institution", toast: () => {}, go: (...args) => navigated.push(args) });
  const props = { ...editor.props, initialValues: { ...editor.props.initialValues, title: "Maths teacher", description: "Teach maths to a primary school class." } };
  const render = () => { index = 0; return editor.type(props); };
  function findButton(tree, label) {
    if (Array.isArray(tree)) return tree.map((child) => findButton(child, label)).find(Boolean);
    if (!tree || typeof tree !== "object") return undefined;
    if (tree.type === "Btn" && tree.props.children === label) return tree;
    return findButton(tree.props?.children, label);
  }
  for (let step = 1; step < 4; step++) {
    const button = findButton(render(), "Continue"); assert.ok(button, `Step ${step} still has Continue`); button.props.onClick();
  }
  const publish = findButton(render(), "Publish job"); assert.ok(publish);
  publish.props.onClick(); publish.props.onClick();
  assert.equal(created.length, 1); assert.equal(created[0].status, "ACTIVE");
  await createOptions.onSuccess({ ok: false, savedJobId: "job-1", message: "Publishing unavailable" });
  assert.equal(navigated.length, 0);
  findButton(render(), "Publish job").props.onClick();
  assert.equal(created.length, 1); assert.equal(updated.length, 1); assert.equal(updated[0].id, "job-1");
  await updateOptions.onSuccess({ ok: true, data: { id: "job-1", status: "ACTIVE" } });
  assert.equal(navigated[0][0], "applications"); assert.equal(navigated[0][1].jobId, "job-1");
});

test("socket polling health follows ready, disconnect, and final rejection", () => {
  const handlers = new Map();
  const socket = { on: (event, handler) => { handlers.set(event, handler); return socket; }, disconnect: () => { handlers.get("disconnect")?.(); return socket; }, connect: () => socket };
  const load = loader({ react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() }, "socket.io-client": { io: () => socket } }, { process: { env: { NEXT_PUBLIC_API_URL: "https://backend.example" } } });
  const stream = load("features/conversations/socket.ts");
  stream.acquireConversationSocket();
  assert.equal(stream.useConversationConnected(), false);
  handlers.get("ready")(); assert.equal(stream.useConversationConnected(), true);
  handlers.get("disconnect")(); assert.equal(stream.useConversationConnected(), false);
  handlers.get("ready")();
  handlers.get("connect_error")({ message: "ORIGIN_NOT_ALLOWED" }); assert.equal(stream.useConversationConnected(), false);
  stream.releaseConversationSocket();
});

test("application counts stop on repeated pagination rather than looping or returning a partial total", async () => {
  let pages = 0;
  const load = loader({ "@/features/jobs/queries": { listMyJobs: async () => { pages++; return { jobs: [{ id: "same-job" }], pagination: { hasNextPage: true } }; } } });
  await assert.rejects(() => load("features/applications/queries.ts").countApplicationsForActiveJobs(), (error) => error.status === 502);
  assert.equal(pages, 2);
});
