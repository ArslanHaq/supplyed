const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadModule(filename, mocks, cache = new Map()) {
  const file = path.resolve(root, filename);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const resolve = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const target = specifier.startsWith("@/") ? path.resolve(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return loadModule(`${target}.ts`, mocks, cache);
    }
    return require(specifier);
  };
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, require: resolve, FormData, Error,
    process: { env: { API_BASE_URL: "https://backend.example/api" } },
  }, { filename: file });
  return loadedModule.exports;
}

function fixture(filename, extraMocks = {}) {
  const patches = [];
  const user = { id: "user-id", email: "teacher@example.com", name: "Teacher", role: null,
    phone: "+447911123456", phoneVerified: true, emailVerified: true };
  const session = { userId: user.id, email: user.email, role: null, accessToken: "test-token", refreshToken: "test-refresh" };
  const actions = loadModule(filename, {
    "next/cache": { revalidateTag: () => {} },
    "@/features/auth/backend": {
      normalizeRole: (role) => role === "INSTRUCTOR" || role === "teacher" ? "teacher" : null,
      normalizeStatus: () => "none",
      normalizeAuthUser: (value) => value,
    },
    "@/features/auth/session-ticket": { createVerifiedEmailSessionTicket: () => "test-ticket" },
    "@/lib/server/auth-context": { getServerAuthContext: async () => session },
    "@/lib/server/token-refresh": { getValidAccessToken: async () => "test-token" },
    "@/lib/server/jwt": { readUnverifiedJwtExpiresAt: () => undefined },
    "@/lib/server/api-client": {
      ApiError: class extends Error {},
      api: { get: async () => user, patch: async (endpoint, body) => patches.push({ endpoint, body }) },
    },
    ...extraMocks,
  });
  return { actions, patches, user, session };
}

test("saving settings cannot overwrite a phone verified in another tab", async () => {
  const snapshot = { role: "teacher", applicationStatus: "approved", user: {
    phone: "+447911123456", phoneVerified: true, name: "Teacher" }, instructor: { id: "instructor-id", fullName: "Teacher" } };
  const { actions, patches, session } = fixture("features/settings/actions.ts", {
    "./queries": { getSettingsProfileSnapshot: async () => snapshot },
  });
  session.role = "INSTRUCTOR";
  const result = await actions.updateSettingsAction({ role: "teacher", user: { name: "Updated name", phone: "+447700900000" },
    instructor: { id: "instructor-id", fullName: "Teacher" } });
  assert.equal(result.ok, true);
  const userPatch = patches.find((call) => call.endpoint === "/users/me");
  assert.deepEqual(JSON.parse(JSON.stringify(userPatch.body)), { name: "Updated name" });
  assert.equal(result.data.user.phoneVerified, true);
  assert.equal(result.data.user.phone, snapshot.user.phone);
});

test("onboarding keeps server phone verification across steps and protects it at profile creation", async () => {
  const { actions, patches, user } = fixture("features/onboarding/actions.ts", {
    "./documents": { getProfileDocumentRequirements: async () => [], getDocumentSnapshots: async () => [] },
  });
  const form = new FormData();
  form.set("role", "teacher");
  form.set("step", "1");
  form.set("email", user.email);
  form.set("fullName", "Teacher");
  form.set("phone", user.phone);
  const saved = await actions.saveOnboardingStepAction(form);
  assert.equal(saved.ok, true);
  assert.equal(saved.data.snapshot.user.phoneVerified, true);
  assert.equal(saved.data.snapshot.user.emailVerified, true);

  form.set("phone", "+447700900000");
  const changedDraft = await actions.saveOnboardingStepAction(form);
  assert.equal(changedDraft.ok, true);
  assert.equal(changedDraft.data.snapshot.user.phoneVerified, false);
  const created = await actions.submitOnboardingAction(form);
  assert.equal(created.ok, false);
  assert.match(created.message, /Verify your new phone number/);
  assert.equal(patches.length, 0);
});
