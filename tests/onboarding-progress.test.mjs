import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);

// Load the real TypeScript modules with isolated backend dependencies.
function loadModule(relativePath, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === "server-only") return {};
    if (id.startsWith("@/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id);
      return loadModule(`${target}.ts`, mocks, cache);
    }
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", source)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { profileEntryStatus, hasCreatedRoleProfile } = loadModule("features/onboarding/profile-progress.ts");
const { isDocumentReadyForReview } = loadModule("features/onboarding/document-utils.ts");
const roles = { teacher: ["instructor", "INSTRUCTOR_PROFILE"], institution: ["institution", "INSTITUTION_PROFILE"], individual: ["recruiter", "RECRUITER_PROFILE"] };
const uploaded = { id: "doc", uploadedAt: "2026-09-15T00:00:00Z", status: "PENDING" };
function snapshot(role, status = "none", documents = {}) {
  return {
    role, applicationStatus: status, [roles[role][0]]: { id: "profile", status },
    documents: {}, requirementDocuments: documents,
    documentRequirements: [{ id: "required", isRequired: true, context: roles[role][1], documentType: { name: "ID" } }],
  };
}

for (const role of Object.keys(roles)) {
  test(`${role}: existing incomplete profile stays in documents even with all uploads`, () => {
    const current = snapshot(role, "none", { required: uploaded });
    assert.equal(hasCreatedRoleProfile(current), true);
    assert.equal(profileEntryStatus(current), "none");
  });
  test(`${role}: missing or rejected required documents prevent workspace entry`, () => {
    assert.equal(profileEntryStatus(snapshot(role, "pending_review")), "none");
    assert.equal(profileEntryStatus(snapshot(role, "approved", { required: { ...uploaded, status: "REJECTED" } })), "none");
    assert.equal(profileEntryStatus(snapshot(role, "pending_review", { required: { ...uploaded, status: "REQUIRES_INFO" } })), "none");
    assert.equal(profileEntryStatus(snapshot(role, "pending_review", { required: uploaded })), "pending_review");
  });
}

test("only completed, usable document versions satisfy a requirement", () => {
  for (const status of ["PENDING", "APPROVED", "NOT_REQUIRED"]) assert.equal(isDocumentReadyForReview({ ...uploaded, status }), true);
  for (const status of ["REJECTED", "REQUIRES_INFO", "", null]) assert.equal(isDocumentReadyForReview({ ...uploaded, status }), false);
  assert.equal(isDocumentReadyForReview({ status: "PENDING" }), false);
});

test("no requirements does not automatically submit an incomplete profile", () => {
  assert.equal(profileEntryStatus({ ...snapshot("teacher"), documentRequirements: [] }), "none");
});

test("rejected profiles can resubmit; suspended profiles remain suspended", () => {
  assert.equal(profileEntryStatus(snapshot("teacher", "rejected", { required: uploaded })), "none");
  assert.equal(profileEntryStatus(snapshot("teacher", "suspended")), "suspended");
});

const requirement = { id: "required", context: "INSTRUCTOR_PROFILE", isRequired: true, isActive: true, documentType: { id: "type", name: "ID", code: "ID", isActive: true, allowedMimes: ["application/pdf"], maxSizeBytes: 100 } };
test("basic users can log in and check onboarding requirements without calling restricted documents API", async () => {
  const reads = [];
  const actions = loadModule("features/onboarding/actions.ts", {
    "next/cache": { revalidateTag() {} },
    "@/lib/server/api-client": { api: { async get(url) {
      reads.push(url);
      if (url === "/auth/me") return { id: "user", email: "test@example.com", role: "USER" };
      if (url === "/document-requirements/profile") return [requirement];
      throw new Error(`Forbidden endpoint for basic user: ${url}`);
    } }, ApiError: class extends Error {} },
    "@/lib/server/auth-context": { getServerAuthContext: async () => ({ userId: "user", role: null, accessToken: "test" }) },
    "@/features/auth/session-ticket": {},
    "@/features/auth/backend": { normalizeRole: (role) => role === "USER" ? null : role, normalizeStatus: () => "none" },
  });
  const snapshot = await actions.getOnboardingProfileSnapshot();
  assert.equal(snapshot.role, null);
  assert.equal(snapshot.applicationStatus, "none");
  const input = new FormData();
  input.set("role", "teacher");
  input.set("step", "1");
  const saved = await actions.saveOnboardingStepAction(input);
  assert.equal(saved.ok, true);
  assert.equal(saved.data.snapshot.documentRequirements.length, 1);
  assert.deepEqual(reads, ["/auth/me", "/document-requirements/profile"]);
});
function documentClient(get) {
  return loadModule("features/onboarding/documents.ts", { "@/lib/server/api-client": { api: { get } } });
}
process.env.API_BASE_URL = "http://test.invalid/api";

test("requirements are requested afresh and configuration errors never become an empty list", async () => {
  let count = 0;
  const client = documentClient(async (url, options) => {
    assert.equal(url, "/document-requirements/profile");
    assert.equal(options.cache, "no-store");
    count += 1;
    return count === 1 ? [] : [requirement];
  });
  assert.equal((await client.getProfileDocumentRequirements("teacher")).length, 0);
  assert.equal((await client.getProfileDocumentRequirements("teacher")).length, 1);
  for (const response of [null, {}, [{ id: "broken" }], [{ ...requirement, context: "INSTITUTION_PROFILE" }]]) {
    await assert.rejects(documentClient(async () => response).getProfileDocumentRequirements("teacher"));
  }
  await assert.rejects(documentClient(async () => { throw new Error("offline"); }).getProfileDocumentRequirements("teacher"), /offline/);
});

test("document checks include every page and use the newest version", async () => {
  const calls = [];
  const client = documentClient(async (url, options) => {
    assert.equal(url, "/documents");
    assert.equal(options.cache, "no-store");
    const page = options.query.page;
    calls.push(page);
    return { documents: [{ id: `doc-${page}`, requirementId: "required", status: page === 1 ? "APPROVED" : "REJECTED", currentVersion: { id: `v${page}`, originalName: "id.pdf", createdAt: `2026-09-${page + 10}T00:00:00Z`, sizeBytes: 50, contentType: "application/pdf" } }], pagination: { hasNextPage: page === 1 } };
  });
  const documents = await client.getDocumentSnapshots();
  assert.deepEqual(calls, [1, 2]);
  assert.equal(documents.required.status, "REJECTED");
  assert.equal(isDocumentReadyForReview(documents.required), false);
});

test("document listing failures block submission", async () => {
  for (const response of [null, {}]) await assert.rejects(documentClient(async () => response).getDocumentSnapshots());
  const client = documentClient(async () => { throw new Error("unavailable"); });
  await assert.rejects(client.getDocumentState("teacher"), /unavailable/);
});

for (const [role, [profileName, context]] of Object.entries(roles)) {
  test(`${role}: resubmission preserves profile fields and requires current documents`, async () => {
    const endpoint = { teacher: "/instructors", institution: "/institutions", individual: "/recruiters" }[role];
    const backendRole = { teacher: "INSTRUCTOR", institution: "INSTITUTION", individual: "RECRUITER" }[role];
    const profile = { id: "existing", status: "INCOMPLETE", fullName: "Original", name: "Original", displayName: "Original" };
    const mutations = [];
    let documentStatus = "REJECTED";
    const api = {
      async get(url) {
        if (url === "/auth/me") return { id: "user", email: "test@example.com", role: backendRole, name: "Original" };
        if (url === `${endpoint}/me`) return profile;
        if (url === "/document-requirements/profile") return [{ ...requirement, context }];
        if (url === "/documents") return [{ id: "doc", requirementId: "required", status: documentStatus, currentVersion: { id: "v1", createdAt: "2026-09-15T00:00:00Z", originalName: "id.pdf", sizeBytes: 50, contentType: "application/pdf" } }];
        throw new Error(`Unexpected read: ${url}`);
      },
      async patch(url) { mutations.push(url); assert.equal(url, `${endpoint}/me/status`); return { ...profile, status: "PENDING" }; },
      async post(url) { throw new Error(`Must not recreate profile: ${url}`); },
    };
    const actions = loadModule("features/onboarding/actions.ts", {
      "next/cache": { revalidateTag() {} },
      "@/lib/server/api-client": { api, ApiError: class extends Error {} },
      "@/lib/server/auth-context": { getServerAuthContext: async () => ({ userId: "user", role, accessToken: "test", refreshToken: "test-refresh" }) },
      "@/features/auth/session-ticket": { createVerifiedEmailSessionTicket: () => "test-ticket" },
      "@/features/auth/backend": {
        normalizeRole: (value) => ({ INSTRUCTOR: "teacher", INSTITUTION: "institution", RECRUITER: "individual" }[value] ?? value),
        normalizeStatus: (value) => ({ INCOMPLETE: "none", PENDING: "pending_review", ACTIVE: "approved", REJECTED: "rejected" }[value] ?? "none"),
        refreshBackendAuth: async () => ({ accessToken: "test", user: { role: backendRole } }),
      },
    });
    const payload = new FormData();
    payload.set("role", role);
    payload.set("intent", "review");
    payload.set("fullName", "Must not overwrite original");
    const blocked = await actions.submitOnboardingAction(payload);
    assert.equal(blocked.ok, true);
    assert.equal(blocked.data.applicationStatus, "none");
    assert.deepEqual(mutations, []);
    assert.equal(blocked.data.snapshot[profileName].id, "existing");
    documentStatus = "PENDING";
    const submitted = await actions.submitOnboardingAction(payload);
    assert.equal(submitted.ok, true);
    assert.equal(submitted.data.applicationStatus, "pending_review");
    assert.deepEqual(mutations, [`${endpoint}/me/status`]);
  });
}
