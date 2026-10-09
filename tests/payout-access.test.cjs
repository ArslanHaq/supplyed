const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const instructorId = "8f0aa7f6-f3d1-4e5b-a7cf-2551e4dfd413";

function fixture(filename, context, configured = true) {
  const calls = [];
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const mocks = {
    "server-only": {},
    "@/lib/server/auth-context": { getServerAuthContext: async () => context },
    "@/lib/server/api-client": {
      ApiError,
      api: { get: async (endpoint, options) => {
        calls.push({ endpoint, options });
        return { connected: true, ready: true, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true };
      } },
    },
  };
  function load(relativePath) {
    const absolutePath = path.resolve(projectRoot, relativePath);
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(absolutePath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      exports, URL, Error,
      process: { env: configured ? { API_BASE_URL: "https://backend.example/api" } : {} },
      require: (specifier) => {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        if (specifier.startsWith(".")) return load(`${path.relative(projectRoot, path.resolve(path.dirname(absolutePath), specifier))}.ts`);
        throw new Error(`Unexpected import ${specifier}`);
      },
    }, { filename: absolutePath });
    return exports;
  }
  return { module: load(filename), calls };
}

test("instructor payout access rejects anonymous, institution, and administrator sessions", async () => {
  for (const [context, status] of [[null, 401], [{ userId: "school", role: "institution" }, 403], [{ userId: "admin", role: "admin" }, 403]]) {
    const { module } = fixture("features/payments/payout-auth.ts", context);
    await assert.rejects(() => module.requirePayoutInstructor(), (error) => error.status === status);
  }
  const { module } = fixture("features/payments/payout-auth.ts", { userId: "teacher", role: "teacher" });
  await module.requirePayoutInstructor();
});

test("admin payout lookup rejects unauthorized sessions before contacting Stripe or the backend", async () => {
  for (const [context, status] of [[null, 401], [{ userId: "teacher", role: "teacher" }, 403], [{ userId: "school", role: "institution" }, 403]]) {
    const { module, calls } = fixture("features/payments/admin-payout-queries.ts", context);
    await assert.rejects(() => module.getInstructorPayoutAccount(instructorId), (error) => error.status === status);
    assert.equal(calls.length, 0);
  }
});

test("admin payout lookup uses the instructor profile ID and bypasses cached provider state", async () => {
  const { module, calls } = fixture("features/payments/admin-payout-queries.ts", { userId: "admin", role: "admin" });
  const account = await module.getInstructorPayoutAccount(instructorId);
  assert.equal(account.ready, true);
  assert.equal(account.payoutsEnabled, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ endpoint: `/payments/payout-accounts/instructor/${instructorId}`, options: { cache: "no-store" } }]);
});

test("admin payout lookup rejects malformed identifiers without a provider request", async () => {
  const { module, calls } = fixture("features/payments/admin-payout-queries.ts", { userId: "admin", role: "admin" });
  for (const id of ["", "../other-account", "not-an-instructor-id"]) {
    await assert.rejects(() => module.getInstructorPayoutAccount(id), (error) => error.status === 400);
  }
  assert.equal(calls.length, 0);
});

test("unconfigured admin payout lookup returns unavailable instead of a fabricated ready account", async () => {
  const { module, calls } = fixture("features/payments/admin-payout-queries.ts", { userId: "admin", role: "admin" }, false);
  await assert.rejects(() => module.getInstructorPayoutAccount(instructorId), (error) => error.status === 503);
  assert.equal(calls.length, 0);
});
