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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
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
  vm.runInNewContext(
    source,
    {
      module: loadedModule,
      exports: loadedModule.exports,
      require: resolveImport,
      URL,
      Response,
      Headers,
      FormData,
      AbortSignal,
      Error,
      ...globals,
    },
    { filename: absolutePath },
  );
  return loadedModule.exports;
}

function submissionFixture({
  session = null,
  response,
  configured = true,
} = {}) {
  const requests = [];
  const authCalls = [];
  const actions = loadModule(
    "features/contact/actions.ts",
    {
      "./auth-context": {
        getServerAuthContext: async () => {
          authCalls.push("session");
          return session;
        },
      },
      "./token-refresh": {
        getValidAccessToken: async () => {
          authCalls.push("token");
          return session?.accessToken ?? null;
        },
        refreshBackendAccessToken: async () => {
          authCalls.push("refresh");
          return null;
        },
        markBackendSessionExpired: async () => {
          authCalls.push("expire");
        },
      },
    },
    {
      process: {
        env: configured ? { API_BASE_URL: "https://backend.example/api" } : {},
      },
      fetch: async (url, init) => {
        requests.push({ url, init, body: JSON.parse(init.body) });
        return (
          response ??
          Response.json({
            success: true,
            data: { id: "interest-123", submitted: true },
          })
        );
      },
    },
  );
  return { actions, requests, authCalls };
}

function interestForm(type, overrides = {}) {
  const values = {
    type,
    email: "  ALEX@EXAMPLE.COM  ",
    area: "Greater Manchester",
    ...(type === "SCHOOL"
      ? {
          name: "  Alex Morgan  ",
          role: "Headteacher",
          organizationName: "  Greenfield School  ",
          schoolType: "Primary",
          supplyDaysPerTerm: "10 to 30",
          coverBookingMethod: "Through an agency",
        }
      : {
          firstName: "  Alex  ",
          lastName: "  Morgan  ",
          role: "Qualified teacher (QTS)",
          currentSupply: "Yes, through an agency",
          daysPerWeek: "3 to 4",
          emailConsent: "on",
        }),
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

function assertPublicRequest(fixture, method = "POST") {
  assert.equal(fixture.requests.length, 1);
  const request = fixture.requests[0];
  assert.equal(request.init.method, method);
  assert.equal(request.init.headers.Authorization, undefined);
  assert.deepEqual(
    fixture.authCalls,
    [],
    "Waitlist requests must not depend on a login session",
  );
  return request;
}

test("school waitlist saves cover preferences and explicit founding interest, with attribution", async () => {
  for (const session of [null, { accessToken: "signed-in-token" }]) {
    const fixture = submissionFixture({ session });
    const result = await fixture.actions.foundingInterestAction(
      null,
      interestForm("SCHOOL", {
        source: " homepage ",
        campaign: " autumn-launch ",
        foundingProgrammeInterest: "on",
      }),
    );
    assert.equal(result.ok, true);
    const request = assertPublicRequest(fixture);
    assert.equal(
      request.url,
      "https://backend.example/api/contact/founding-interest",
    );
    assert.deepEqual(request.body, {
      type: "SCHOOL",
      name: "Alex Morgan",
      email: "alex@example.com",
      role: "Headteacher",
      area: "Greater Manchester",
      organizationName: "Greenfield School",
      schoolType: "Primary",
      supplyDaysPerTerm: "10 to 30",
      coverBookingMethod: "Through an agency",
      foundingProgrammeInterest: true,
      source: "homepage",
      campaign: "autumn-launch",
    });
  }
});

test("teachers join with split names and supply preferences without phone, postcode or phases", async () => {
  const fixture = submissionFixture();
  const result = await fixture.actions.foundingInterestAction(
    null,
    interestForm("TEACHER"),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(assertPublicRequest(fixture).body, {
    type: "TEACHER",
    name: "Alex Morgan",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex@example.com",
    role: "Qualified teacher (QTS)",
    area: "Greater Manchester",
    currentSupply: "Yes, through an agency",
    daysPerWeek: "3 to 4",
    emailConsent: true,
    source: "founding-teachers-landing",
  });
});

test("invalid role, area, consent and supply preferences are rejected before any network call", async () => {
  const cases = [
    ["SCHOOL", "name", ""],
    ["SCHOOL", "email", "not-an-email"],
    ["SCHOOL", "organizationName", ""],
    ["SCHOOL", "role", "Qualified teacher (QTS)"],
    ["SCHOOL", "schoolType", ""],
    ["SCHOOL", "area", "Both"],
    ["SCHOOL", "supplyDaysPerTerm", "lots"],
    ["SCHOOL", "coverBookingMethod", ""],
    ["TEACHER", "firstName", ""],
    ["TEACHER", "lastName", ""],
    ["TEACHER", "phone", "letters"],
    ["TEACHER", "phone", "++++++++++"],
    ["TEACHER", "role", "Headteacher"],
    ["TEACHER", "area", "Somewhere else"],
    ["TEACHER", "emailConsent", ""],
    ["TEACHER", "currentSupply", ""],
    ["TEACHER", "daysPerWeek", "9"],
  ];
  for (const [type, field, value] of cases) {
    const fixture = submissionFixture();
    const result = await fixture.actions.foundingInterestAction(
      null,
      interestForm(type, { [field]: value }),
    );
    assert.equal(result.ok, false, `${type}: ${field}`);
    assert.ok(
      result.fieldErrors[field],
      `${field} should identify the problem`,
    );
    assert.equal(fixture.requests.length, 0);
  }
});

test("duplicate submission stays a confirmation and does not invent an optional-details token", async () => {
  const data = {
    id: "existing-interest",
    submitted: true,
    alreadyRegistered: true,
    confirmationEmailSent: false,
  };
  const fixture = submissionFixture({
    response: Response.json({ success: true, data }),
  });
  const result = await fixture.actions.foundingInterestAction(
    null,
    interestForm("TEACHER"),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, data);
  assert.match(result.message, /already registered/i);
  assert.equal(result.data.detailsToken, undefined);
});

test("optional teacher details use the submission capability, normalize postcode and preserve multiple phases", async () => {
  const fixture = submissionFixture({
    response: Response.json({ success: true, data: { saved: true } }),
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "interest-123",
    token: "a".repeat(64),
    postcode: " m20 ",
    mainSubject: " Maths ",
  }))
    form.set(key, value);
  form.append("phases", "Primary");
  form.append("phases", "Secondary");
  form.append("phases", "Primary");
  const result = await fixture.actions.saveWaitlistDetailsAction(null, form);
  assert.equal(result.ok, true);
  const request = assertPublicRequest(fixture, "PATCH");
  assert.equal(
    request.url,
    "https://backend.example/api/contact/founding-interest/interest-123/details",
  );
  assert.deepEqual(request.body, {
    token: "a".repeat(64),
    phases: ["Primary", "Secondary"],
    mainSubject: "Maths",
    postcode: "M20",
  });
});

test("optional details reject missing capabilities and invalid fields without a request", async () => {
  for (const values of [
    {},
    { id: "x", token: "y", postcode: "bad postcode" },
    { id: "x", token: "y", phases: "University" },
  ]) {
    const fixture = submissionFixture();
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    assert.equal(
      (await fixture.actions.saveWaitlistDetailsAction(null, form)).ok,
      false,
    );
    assert.equal(fixture.requests.length, 0);
  }
});

test("backend failures and missing configuration never claim a successful submission", async () => {
  for (const status of [400, 401, 503]) {
    const fixture = submissionFixture({
      response: Response.json(
        { success: false, message: "Unavailable" },
        { status },
      ),
    });
    assert.equal(
      (
        await fixture.actions.foundingInterestAction(
          null,
          interestForm("TEACHER"),
        )
      ).ok,
      false,
    );
  }
  const fixture = submissionFixture({ configured: false });
  const result = await fixture.actions.foundingInterestAction(
    null,
    interestForm("TEACHER"),
  );
  assert.equal(result.code, "BACKEND_NOT_CONFIGURED");
  assert.equal(fixture.requests.length, 0);
});
