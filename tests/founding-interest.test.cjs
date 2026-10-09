const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

// Exercise the real action, validation, response helpers and API client.
// Fetch and auth are isolated: no request or email leaves this process.
function loadModule(filename, mocks, globals, cache = new Map()) {
  const absolutePath = path.resolve(projectRoot, filename);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;
  const loadedModule = { exports: {} };
  cache.set(absolutePath, loadedModule);
  const source = ts.transpileModule(fs.readFileSync(absolutePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolutePath,
  }).outputText;
  const resolveImport = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const dependency = specifier.startsWith("@/")
        ? path.resolve(projectRoot, specifier.slice(2))
        : path.resolve(path.dirname(absolutePath), specifier);
      return loadModule(`${dependency}.ts`, mocks, globals, cache);
    }
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, require: resolveImport,
    URL, Response, Headers, FormData, AbortSignal, Error, ...globals,
  }, { filename: absolutePath });
  return loadedModule.exports;
}

function submissionFixture({ session = null, response, configured = true } = {}) {
  const requests = [];
  const authCalls = [];
  const actions = loadModule("features/contact/actions.ts", {
    "./auth-context": { getServerAuthContext: async () => {
      authCalls.push("session");
      return session;
    } },
    "./token-refresh": {
      getValidAccessToken: async () => { authCalls.push("token"); return session?.accessToken ?? null; },
      refreshBackendAccessToken: async () => { authCalls.push("refresh"); return null; },
      markBackendSessionExpired: async () => { authCalls.push("expire"); },
    },
  }, {
    process: { env: configured ? { API_BASE_URL: "https://backend.example/api" } : {} },
    fetch: async (url, init) => {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return response ?? Response.json({ success: true, data: { id: "interest-123", submitted: true } });
    },
  });
  return { actions, requests, authCalls };
}

function interestForm(type, overrides = {}) {
  const values = {
    type,
    name: "  Alex Morgan  ",
    email: "  ALEX@EXAMPLE.COM  ",
    phone: "  +44 7700 900123  ",
    postcode: "  sw1a 1aa  ",
    ...(type === "SCHOOL"
      ? { role: "Head Teacher", organizationName: "  Greenfield School  ", schoolType: "Primary" }
      : { role: "Supply teacher (qualified)", phase: "Primary" }),
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

function assertPublicRequest(fixture) {
  assert.equal(fixture.requests.length, 1);
  const request = fixture.requests[0];
  assert.equal(request.url, "https://backend.example/api/contact/founding-interest");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["Content-Type"], "application/json");
  assert.equal(request.init.headers.Authorization, undefined);
  assert.deepEqual(fixture.authCalls, [], "Public interest capture must not read, refresh or expire a login session");
  return request.body;
}

test("the simple school form preserves its public email endpoint, contact details and campaign attribution", async () => {
  for (const session of [null, { accessToken: "signed-in-token", refreshToken: "refresh-token" }]) {
    const fixture = submissionFixture({ session });
    const result = await fixture.actions.foundingInterestAction(null, interestForm("SCHOOL", {
      source: "  homepage  ", campaign: "  autumn-launch  ", message: "  We need primary cover.  ",
    }));
    assert.equal(result.ok, true);
    assert.equal(result.data.submitted, true);
    assert.equal(result.data.id, "interest-123");
    assert.deepEqual(assertPublicRequest(fixture), {
      availability: "", campaign: "autumn-launch", email: "alex@example.com",
      message: "We need primary cover.", name: "Alex Morgan", organizationName: "Greenfield School",
      phone: "+44 7700 900123", phase: "", postcode: "SW1A 1AA", role: "Head Teacher",
      schoolType: "Primary", source: "homepage", tier: "", type: "SCHOOL",
    });
  }
});

test("the simple teacher form submits publicly without profile fields for visitors and signed-in users", async () => {
  for (const session of [null, { accessToken: "signed-in-token", refreshToken: "refresh-token" }]) {
    const fixture = submissionFixture({ session });
    const result = await fixture.actions.foundingInterestAction(null, interestForm("TEACHER"));
    assert.equal(result.ok, true);
    assert.deepEqual(assertPublicRequest(fixture), {
      availability: "", email: "alex@example.com", message: "", name: "Alex Morgan",
      organizationName: "", phone: "+44 7700 900123", phase: "Primary", postcode: "SW1A 1AA",
      role: "Supply teacher (qualified)", schoolType: "", source: "founding-teachers-landing",
      tier: "", type: "TEACHER",
    });
  }
});

test("missing or invalid required contact and role details prevent submission", async () => {
  const cases = [
    ["SCHOOL", "name", ""], ["SCHOOL", "email", "not-an-email"],
    ["TEACHER", "phone", ""], ["TEACHER", "phone", "letters"],
    ["TEACHER", "postcode", ""], ["SCHOOL", "role", "Supply teacher (qualified)"],
    ["SCHOOL", "organizationName", ""], ["SCHOOL", "schoolType", ""],
    ["TEACHER", "role", "Head Teacher"], ["TEACHER", "phase", ""],
  ];
  for (const [type, field, value] of cases) {
    const fixture = submissionFixture();
    const result = await fixture.actions.foundingInterestAction(null, interestForm(type, { [field]: value }));
    assert.equal(result.ok, false, `${type}: ${field}`);
    assert.ok(result.fieldErrors[field], `${type}: ${field} needs a useful field error`);
    assert.equal(fixture.requests.length, 0);
  }
});

test("duplicate interest preserves the backend response and confirms registration without a signup instruction", async () => {
  const data = { id: "existing-interest", submitted: true, alreadyRegistered: true };
  const fixture = submissionFixture({ response: Response.json({ success: true, data }) });
  const result = await fixture.actions.foundingInterestAction(null, interestForm("SCHOOL"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, data);
  assert.match(result.message, /already registered/i);
  assert.doesNotMatch(result.message, /sign.?up|log.?in/i);
  assert.equal(assertPublicRequest(fixture).source, "founding-schools-landing");
});

test("backend email service failures remain errors rather than showing a successful submission", async () => {
  for (const [status, message, expected] of [
    [503, "Email transport unavailable", /could not send your details.*try again/i],
    [400, "Please use a different contact number.", /Please use a different contact number\./],
    [401, "Contact service unavailable.", /Contact service unavailable\./],
  ]) {
    const fixture = submissionFixture({
      session: { accessToken: "signed-in-token", refreshToken: "refresh-token" },
      response: Response.json({ success: false, data: null, message }, { status }),
    });
    const result = await fixture.actions.foundingInterestAction(null, interestForm("TEACHER"));
    assert.equal(result.ok, false);
    assert.match(result.message, expected);
    assertPublicRequest(fixture);
  }
});

test("an unconfigured backend prevents a submission instead of claiming an email was sent", async () => {
  const fixture = submissionFixture({ configured: false });
  const result = await fixture.actions.foundingInterestAction(null, interestForm("TEACHER"));
  assert.equal(result.ok, false);
  assert.equal(result.code, "BACKEND_NOT_CONFIGURED");
  assert.equal(fixture.requests.length, 0);
});
