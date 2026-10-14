// Run after `npm run build`: npm run test:smoke
// A real production Next server talks only to this in-memory local backend/storage.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { test, before, after } = require("node:test");
const { encode } = require("next-auth/jwt");
const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.node");

const root = path.resolve(__dirname, "..");
const secret = "isolated-production-smoke-secret-never-used-outside-tests";
const jobs = new Map(), uploads = new Map(), documents = new Map();
let backend, app, origin, storageOrigin, logs = "", failActivation = false, failRefresh = false, refreshCalls = 0;
let manifest;
let onboardingFixture = null;
const cookies = {};

function jwt(userId, expires = 3600) {
  return `header.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + expires })).toString("base64url")}.signature`;
}
function userFor(req) {
  const payload = req.headers.authorization?.slice(7).split(".")[1];
  const id = payload ? JSON.parse(Buffer.from(payload, "base64url").toString()).sub : "anonymous";
  return { id, email: `${id}@example.test`, name: "Smoke Test", emailVerified: true, phoneVerified: true,
    phone: "+447912123456", role: id === "school-user" ? "INSTITUTION" : "INSTRUCTOR", applicationStatus: "APPROVED" };
}
async function body(req) { const parts = []; for await (const part of req) parts.push(part); return Buffer.concat(parts); }
async function jsonBody(req) { return JSON.parse((await body(req)).toString() || "{}"); }
function json(res, data, status = 200) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); }

async function handleBackend(req, res) {
  const url = new URL(req.url, storageOrigin);
  const route = url.pathname.replace(/^\/api/, "");
  if (route.startsWith("/storage/") && req.method === "PUT") {
    uploads.set(route, { bytes: await body(req), type: req.headers["content-type"] }); return json(res, {});
  }
  if (route.startsWith("/storage/")) {
    const file = uploads.get(route);
    if (!file) return json(res, {}, 404);
    res.writeHead(200, { "Content-Type": file.type, "Content-Length": file.bytes.length }); return res.end(file.bytes);
  }
  if (route === "/auth/refresh") {
    refreshCalls++;
    const input = await jsonBody(req);
    if (failRefresh) return json(res, { message: "Temporarily unavailable" }, 503);
    return json(res, { accessToken: jwt(input.refreshToken.includes("school") ? "school-user" : "teacher-user"), refreshToken: jwt(input.refreshToken.includes("school") ? "school-user" : "teacher-user") });
  }
  if (!req.headers.authorization) return json(res, { message: "Unauthorized" }, 401);
  const user = { ...userFor(req), ...(onboardingFixture?.user ?? {}) };
  if (route === "/auth/me") return json(res, user);
  if (onboardingFixture) {
    if (route === "/users/me" && req.method === "PATCH") {
      const input = await jsonBody(req);
      onboardingFixture.writes.push(input);
      Object.assign(onboardingFixture.user, input);
      if (input.phone !== undefined && input.phone !== user.phone) onboardingFixture.user.phoneVerified = false;
      return json(res, { ...user, ...onboardingFixture.user });
    }
    if (route === `/users/${user.id}`) return json(res, user);
    if (route === "/instructors/me") return onboardingFixture.profile ? json(res, onboardingFixture.profile) : json(res, { message: "No profile" }, 404);
    if (route === "/instructors" && req.method === "POST") {
      onboardingFixture.profile = { ...(await jsonBody(req)), id: "new-teacher-profile", status: "DRAFT" };
      return json(res, onboardingFixture.profile);
    }
    if (route === "/documents") return json(res, { documents: [], pagination: { hasNextPage: false } });
    if (route === "/document-requirements/profile") return json(res, [{ id: "new-proof", context: "INSTRUCTOR_PROFILE", isRequired: true, documentType: { id: "new-type", code: "ID", name: "Photo ID", allowedMimes: ["application/pdf"], maxSizeBytes: 10485760 } }]);
  }
  if (route === "/instructors/me") return json(res, { id: "teacher-profile", status: "APPROVED", fullName: user.name, keyStages: [], subjects: [], skills: [] });
  if (route === "/institutions/me") return json(res, { id: "school-profile", status: "APPROVED", name: "Test School", institutionType: "SCHOOL" });
  if (route === "/document-requirements/profile") return json(res, [{ id: "req-1", context: user.role === "INSTITUTION" ? "INSTITUTION_PROFILE" : "INSTRUCTOR_PROFILE", isRequired: false, documentType: { id: "type-1", code: "ID", name: "Photo ID", allowedMimes: ["application/pdf", "image/png"], maxSizeBytes: 10 * 1024 * 1024 } }]);
  if (route === "/documents" && req.method === "GET") return json(res, { documents: [...documents.values()], pagination: { hasNextPage: false } });
  if (route === "/documents" && req.method === "POST") {
    const input = await jsonBody(req); const document = { id: "doc-1", requirementId: input.requirementId };
    documents.set(document.id, document); return json(res, document);
  }
  if (route === "/documents/doc-1/upload-url") {
    const input = await jsonBody(req);
    return json(res, { url: `${storageOrigin}/storage/doc-1`, fileKey: "doc-1", requiredHeaders: { "Content-Type": input.contentType } });
  }
  if (route === "/documents/doc-1/upload-complete") {
    const input = await jsonBody(req), stored = uploads.get("/storage/doc-1");
    assert.ok(stored);
    const document = { ...documents.get("doc-1"), fileKey: input.fileKey, originalName: input.originalName, contentType: stored.type, sizeBytes: stored.bytes.length, status: "PENDING", uploadedAt: new Date().toISOString() };
    documents.set("doc-1", document); return json(res, document);
  }
  if (route === "/documents/doc-1/download-url") return json(res, { url: `${storageOrigin}/storage/doc-1` });
  if (route === "/conversations/c-1/attachments" && req.method === "POST") {
    const input = await jsonBody(req);
    return json(res, { attachment: { id: "attachment-1", ...input }, upload: { url: `${storageOrigin}/storage/attachment-1`, requiredHeaders: { "Content-Type": input.contentType } } });
  }
  if (route === "/conversations/c-1/attachments/attachment-1/download-url") return json(res, { url: `${storageOrigin}/storage/attachment-1` });
  if (route === "/users/me/profile-image/upload-url") {
    const input = await jsonBody(req); return json(res, { url: `${storageOrigin}/storage/photo`, fileKey: "photo", requiredHeaders: { "Content-Type": input.contentType } });
  }
  if (route === "/users/me/profile-image/upload-complete") { assert.ok(uploads.has("/storage/photo")); return json(res, { imageUrl: `${storageOrigin}/storage/photo` }); }
  if (route === "/users/me/profile-image") return json(res, { imageUrl: null });
  if (route === "/jobs" && req.method === "POST") {
    const input = await jsonBody(req); const job = { ...input, id: `job-${jobs.size + 1}`, status: "DRAFT", postedByUserId: user.id };
    jobs.set(job.id, job); return json(res, job);
  }
  if (/^\/jobs\/job-\d+$/.test(route) && req.method === "PATCH") {
    const input = await jsonBody(req);
    if (failActivation) return json(res, { message: "Activation unavailable" }, 503);
    const id = route.split("/").at(-1), job = { ...jobs.get(id), ...input };
    jobs.set(id, job); return json(res, job);
  }
  if (/^\/jobs\/mine\/job-\d+$/.test(route) && req.method === "GET") {
    const job = jobs.get(route.split("/").at(-1));
    return job ? json(res, job) : json(res, { message: "Job not found" }, 404);
  }
  return json(res, { message: `Unhandled fixture route ${req.method} ${route}` }, 404);
}

before(async () => {
  assert.ok(fs.existsSync(path.join(root, ".next/BUILD_ID")), "Run npm run build before the HTTP smoke tests.");
  manifest = JSON.parse(fs.readFileSync(path.join(root, ".next/server/server-reference-manifest.json"), "utf8"));
  backend = http.createServer((req, res) => { handleBackend(req, res).catch((error) => { console.error(error); json(res, {}, 500); }); });
  backend.listen(0, "127.0.0.1"); await once(backend, "listening");
  storageOrigin = `http://127.0.0.1:${backend.address().port}`;
  const reservation = http.createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port; await new Promise((resolve) => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", AUTH_SECRET: secret, AUTH_URL: origin, NEXTAUTH_URL: origin,
      API_BASE_URL: `${storageOrigin}/api`, NEXT_TELEMETRY_DISABLED: "1", AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "",
      AUTH_MICROSOFT_ENTRA_ID_ID: "", AUTH_MICROSOFT_ENTRA_ID_SECRET: "", AUTH_BACKEND_OAUTH_ENABLED: "false" },
  });
  app.stdout.on("data", (data) => { logs = (logs + data).slice(-12000); });
  app.stderr.on("data", (data) => { logs = (logs + data).slice(-12000); });
  let healthy = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (app.exitCode !== null) throw new Error(`Next exited: ${logs}`);
    try { healthy = (await fetch(`${origin}/api/health`)).ok; if (healthy) break; } catch { /* wait for startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(healthy, logs);
  for (const [role, id] of [["teacher", "teacher-user"], ["institution", "school-user"]]) {
    const value = await encode({ secret, salt: "authjs.session-token", token: { sub: id, userId: id, email: `${id}@example.test`, name: "Smoke Test", role, appEmailVerified: true, applicationStatus: "approved", accessToken: jwt(id), refreshToken: jwt(id), instructorProfileId: "teacher-profile", institutionProfileId: "school-profile" } });
    cookies[role] = `authjs.session-token=${value}`;
  }
}, { timeout: 45000 });

after(async () => {
  if (app && app.exitCode === null) { app.kill(); await once(app, "exit"); }
  if (backend) { backend.closeAllConnections(); await new Promise((resolve) => backend.close(resolve)); }
});

function request(route, options = {}, role = "teacher") {
  return fetch(`${origin}${route}`, { ...options, headers: { Cookie: cookies[role], Origin: origin, ...options.headers }, redirect: "manual", signal: AbortSignal.timeout(30000) });
}
async function action(name, args, role = "teacher") {
  const item = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
  assert.ok(item, `Missing built action ${name}`);
  const payload = await encodeReply(args);
  const response = await request(role === "institution" ? "/post-job" : "/settings", { method: "POST", body: payload, headers: { "Next-Action": item[0], ...(typeof payload === "string" ? { "Content-Type": "text/plain;charset=UTF-8" } : {}) } }, role);
  const text = await response.text();
  assert.equal(response.status, 200, `${name}: ${text.slice(0, 1500)}\n${logs}`);
  return text;
}

test("production health, login and protected pages render with the existing routing", async () => {
  assert.equal((await request("/api/health")).status, 200);
  assert.equal((await fetch(`${origin}/login`)).status, 200);
  const guest = await fetch(`${origin}/dashboard`, { redirect: "manual" });
  assert.equal(guest.status, 307); assert.ok(guest.headers.get("location").endsWith("/login"));
  for (const [route, role] of [["/dashboard", "teacher"], ["/settings", "teacher"], ["/post-job", "institution"]]) {
    const response = await request(route, {}, role), text = await response.text();
    assert.equal(response.status, 200, `${route}: ${text.slice(0, 500)}\n${logs}`);
    assert.doesNotMatch(text, /We could not load this workspace/);
  }
});

test("actual onboarding upload and preview preserve a PDF and replace it without creating another document", async () => {
  for (const content of ["%PDF-1.4 first", "%PDF-1.4 replacement"]) {
    const form = new FormData(); form.set("file", new File([content], "certificate.pdf", { type: "application/pdf" })); form.set("requirementId", "req-1");
    const response = await request("/api/onboarding/documents", { method: "POST", body: form });
    const result = await response.json(); assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(uploads.get("/storage/doc-1").bytes.toString(), content);
    const preview = await request("/api/onboarding/documents/doc-1/preview?name=certificate.pdf");
    assert.equal(preview.status, 200); assert.equal(preview.headers.get("content-type"), "application/pdf");
    assert.match(preview.headers.get("content-disposition"), /^inline/); assert.equal(await preview.text(), content);
  }
  assert.equal(documents.size, 1);
});

test("actual conversation uploads preserve bytes, previews work, and anonymous uploads are rejected", async () => {
  const form = new FormData(); form.set("file", new File(["attachment content"], "notes.txt", { type: "text/plain" }));
  const response = await request("/api/conversations/c-1/attachments", { method: "POST", body: form });
  assert.equal(response.status, 200); assert.equal((await response.json()).id, "attachment-1");
  const preview = await request("/api/conversations/c-1/attachments/attachment-1/preview");
  assert.equal(preview.status, 200); assert.equal(await preview.text(), "attachment content");
  const guest = await fetch(`${origin}/api/conversations/c-1/attachments`, { method: "POST", body: form, headers: { Origin: origin } });
  assert.equal(guest.status, 401);
});

test("actual Server Action accepts a 5 MiB profile photo and finalizes storage", async () => {
  const form = new FormData(); form.set("file", new File([Buffer.alloc(5 * 1024 * 1024, 65)], "photo.png", { type: "image/png" }));
  const text = await action("uploadSettingsProfileImageAction", [form]);
  assert.match(text, /"ok":true/); assert.equal(uploads.get("/storage/photo").bytes.length, 5 * 1024 * 1024);
});

test("production rejects oversized or cross-origin uploads and serves unsafe previews as downloads", async () => {
  const form = new FormData(); form.set("file", new File([Buffer.alloc(11 * 1024 * 1024)], "large.pdf", { type: "application/pdf" }));
  const oversized = await request("/api/conversations/c-1/attachments", { method: "POST", body: form });
  assert.equal(oversized.status, 413);
  const forbidden = await request("/api/conversations/c-1/attachments", { method: "POST", body: "unused", headers: { Origin: "https://another.example" } });
  assert.equal(forbidden.status, 403);
  const original = uploads.get("/storage/doc-1");
  try {
    uploads.set("/storage/doc-1", { bytes: Buffer.from("<script>alert(1)</script>"), type: "text/html" });
    const preview = await request("/api/onboarding/documents/doc-1/preview?name=unsafe.html");
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("content-disposition"), /^attachment/);
    assert.equal(preview.headers.get("content-type"), "application/octet-stream");
    assert.equal(preview.headers.get("content-security-policy"), "sandbox");
  } finally { uploads.set("/storage/doc-1", original); }
  const image = await request("/_next/image?url=%2Ffavicon.ico&w=64&q=75");
  assert.equal(image.status, 404);
});

test("actual job actions create drafts, publish and retry failed activation without another creation", async () => {
  const input = { title: "Test role", description: "Teaching an inclusive primary classroom.", keyStages: ["KS2"], status: "DRAFT", payType: "daily", payAmount: 200 };
  assert.match(await action("createJobAction", [input], "institution"), /"ok":true/);
  assert.equal(jobs.get("job-1").status, "DRAFT");
  assert.match(await action("createJobAction", [{ ...input, status: "ACTIVE" }], "institution"), /"ok":true/);
  assert.equal(jobs.get("job-2").status, "ACTIVE");
  failActivation = true;
  const partial = await action("createJobAction", [{ ...input, status: "ACTIVE" }], "institution");
  assert.match(partial, /"savedJobId":"job-3"/);
  failActivation = false;
  assert.match(await action("updateJobAction", [{ ...input, id: "job-3", status: "ACTIVE" }], "institution"), /"ok":true/);
  assert.equal(jobs.size, 3); assert.equal(jobs.get("job-3").status, "ACTIVE");
});

test("real session-cookie refresh persists rotated tokens and a transient outage never signs the user out", async () => {
  async function expiredCookie(refreshToken) {
    return `authjs.session-token=${await encode({ secret, salt: "authjs.session-token", token: { sub: "teacher-user", userId: "teacher-user", role: "teacher", email: "teacher-user@example.test", appEmailVerified: true, applicationStatus: "approved", accessToken: jwt("teacher-user", -10), refreshToken } })}`;
  }
  const cookie = await expiredCookie("teacher-refresh-test");
  const responses = await Promise.all(Array.from({ length: 3 }, () => request("/api/auth/me", { headers: { Cookie: cookie } })));
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(refreshCalls, 1); assert.ok(responses.every((response) => response.headers.has("set-cookie")));
  failRefresh = true;
  const failed = await request("/api/auth/me", { headers: { Cookie: await expiredCookie("other-teacher-refresh") } });
  assert.equal(failed.status, 503); assert.equal(failed.headers.has("set-cookie"), false);
  failRefresh = false;
  const renderCookie = await expiredCookie("teacher-render-refresh");
  const beforeRender = refreshCalls;
  assert.equal((await request("/dashboard", { headers: { Cookie: renderCookie } })).status, 200);
  const afterRender = await request("/api/auth/me", { headers: { Cookie: renderCookie } });
  assert.equal(afterRender.status, 200); assert.ok(afterRender.headers.has("set-cookie"));
  assert.equal(refreshCalls - beforeRender, 1, "The render and following writable request must share the rotated pair");
});

test("built phone Server Action rejects foreign and malformed numbers before sending", async () => {
  for (const phone of ["+12025550123", "+923001234567", "123", ""]) {
    const result = await action("sendPhoneOtpAction", [{ phone }]);
    assert.match(result, /Enter a valid UK phone number/);
    assert.match(result, /"fieldErrors":\{"phone":/);
  }
});

test("built job Server Action rejects foreign country, town and postal code without a write", async () => {
  const before = jobs.size;
  const input = { title: "Validation fixture", description: "Teaching an inclusive primary classroom.", keyStages: ["KS2"], status: "DRAFT" };
  for (const fields of [{ countryCode: "US" }, { city: "Toronto" }, { postalCode: "90210" }]) {
    const result = await action("createJobAction", [{ ...input, ...fields }], "institution");
    assert.match(result, /"ok":false/);
    assert.match(result, /"fieldErrors":/);
  }
  assert.equal(jobs.size, before);
});

test("actual website filter endpoints reject invalid direct query requests", async () => {
  for (const route of ["/api/instructors/directory?city=Toronto", "/api/instructors/directory?minRating=6", "/api/jobs?page=-1", "/api/jobs?limit=101", "/api/bookings/me?from=2099-02-30"]) {
    const response = await request(route, {}, "institution");
    assert.equal(response.status, 400, `${route}: ${await response.text()}`);
  }
});

test("built teacher creation replaces an old Pakistani phone with normalized UK input, but rejects Pakistani input", async () => {
  const values = { role: "teacher", step: "2", intent: "profile", fullName: "Teacher Example", email: "teacher-user@example.test", profileCountryCode: "GB", profileCity: "London", postcode: "sw1a1aa", subjects: '["Maths"]', keyStages: '["KS2"]', skills: "[]", yearsExperience: "3", bio: "Experienced teacher supporting inclusive classroom learning every day.", currency: "GBP" };
  const makeForm = phone => { const form = new FormData(); for (const [key, value] of Object.entries({ ...values, phone })) form.set(key, value); return form; };
  try {
    for (const [phone, expected] of [["07912 123456", "+447912123456"], ["0044 (0)7912 123456", "+447912123456"], ["+44 (0)20 7946 0000", "+442079460000"]]) {
      onboardingFixture = { user: { phone: "+923001234567", phoneVerified: false }, writes: [], profile: null };
      const rejected = await action("submitOnboardingAction", [makeForm("+923001234567")]);
      assert.match(rejected, /"ok":false/); assert.match(rejected, /"phone":"Enter a valid UK phone number/);
      assert.equal(onboardingFixture.writes.length, 0);
      const result = await action("submitOnboardingAction", [makeForm(phone)]);
      assert.match(result, /"ok":true/, result.slice(0, 2500));
      assert.equal(onboardingFixture.writes[0].phone, expected);
      assert.equal(onboardingFixture.user.phone, expected);
      assert.equal(onboardingFixture.user.phoneVerified, false);
      assert.equal(onboardingFixture.profile.countryCode, "GB");
      assert.equal(onboardingFixture.profile.postalCode, "SW1A 1AA");
    }
  } finally { onboardingFixture = null; }
});
