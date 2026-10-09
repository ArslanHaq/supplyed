const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const bookingId = "4d79c36a-6df5-4ca4-96a0-431f321f2ac3";
const invoiceId = "0d4ca099-8c9c-43f4-9a6e-7615b4d6d6bc";

function attachmentPreviewFixture({ contentType = "image/png", size = 100, status = 200, denied = false } = {}) {
  const calls = [];
  class BackendError extends Error {
    constructor() { super("File not found"); this.status = 404; }
  }
  const backend = {
    ApiError: BackendError,
    api: { get: async (endpoint) => {
      calls.push(endpoint);
      if (denied) throw new BackendError();
      return { url: "https://storage.example/signed-file" };
    } },
  };
  const route = loadModule("app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts", {
    "@/lib/server/api-client": backend,
    "./api-client": backend,
  }, {
    fetch: async (url) => {
      calls.push(url);
      return new Response("file bytes", { status, headers: {
        "Content-Type": contentType, "Content-Length": String(size), "Content-Disposition": "attachment",
      } });
    },
  });
  return { calls, get: () => route.GET(new Request("http://localhost/api/preview"), {
    params: Promise.resolve({ id: "conversation-1", attachmentId: "attachment-1" }),
  }) };
}

test("attachment previews authorize with the backend and serve private inline bytes", async () => {
  for (const contentType of ["image/png", "image/jpeg", "application/pdf", "text/plain"]) {
    const fixture = attachmentPreviewFixture({ contentType });
    const response = await fixture.get();
    assert.equal(response.status, 200);
    assert.deepEqual(fixture.calls, ["/conversations/conversation-1/attachments/attachment-1/download-url", "https://storage.example/signed-file"]);
    assert.equal(response.headers.get("Content-Disposition"), "inline");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Content-Type").split(";")[0], contentType);
    assert.equal(await response.text(), "file bytes");
  }
});

test("attachment previews do not read storage when backend access is denied", async () => {
  const fixture = attachmentPreviewFixture({ denied: true });
  const response = await fixture.get();
  assert.equal(response.status, 404);
  assert.equal(fixture.calls.length, 1);
});

test("attachment previews reject active content and unsupported file types", async () => {
  for (const contentType of ["text/html", "image/svg+xml", "application/msword", "application/octet-stream"]) {
    assert.equal((await attachmentPreviewFixture({ contentType }).get()).status, 415);
  }
});

test("attachment previews report storage failures and oversized files", async () => {
  assert.equal((await attachmentPreviewFixture({ status: 403 }).get()).status, 502);
  assert.equal((await attachmentPreviewFixture({ size: 10 * 1024 * 1024 + 1 }).get()).status, 413);
});

// Compile the real server modules with isolated backend/auth dependencies.
// Tests never contact Twilio or Stripe and never use local credentials.
function loadModule(filename, mocks = {}, globals = {}, cache = new Map()) {
  const absolutePath = path.resolve(projectRoot, filename);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;
  const loadedModule = { exports: {} };
  cache.set(absolutePath, loadedModule);
  const source = ts.transpileModule(fs.readFileSync(absolutePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: absolutePath,
  }).outputText;
  const resolveImport = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const dependencyPath = specifier.startsWith("@/")
        ? path.resolve(projectRoot, specifier.slice(2))
        : path.resolve(path.dirname(absolutePath), specifier);
      return loadModule(`${dependencyPath}.ts`, mocks, globals, cache);
    }
    return require(specifier);
  };
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, require: resolveImport,
    URL, Response, Request, Headers, FormData, AbortSignal, Error, console,
    process: { env: { API_BASE_URL: "https://backend.example/api" } },
    ...globals,
  }, { filename: absolutePath });
  return loadedModule.exports;
}

function invoice() {
  return { id: invoiceId, status: "OPEN", booking: { id: bookingId }, rateAmount: 180,
    teacherAmountPence: 81000, feeAmountPence: 10125, totalAmountPence: 91125,
    amountRefundedPence: 0, unitsWorked: 4.5, currency: "gbp" };
}

function actionsFixture(filename, response = invoice(), session = { userId: "user-id" }) {
  const calls = [];
  const tags = [];
  class BackendError extends Error {
    constructor(message, status, requestId) { super(message); this.status = status; this.requestId = requestId; }
  }
  const actions = loadModule(filename, {
    "./payout-auth": { requirePayoutInstructor: async () => {} },
    "next/cache": { revalidateTag: (tag) => tags.push(tag) },
    "@/lib/server/auth-context": { getServerAuthContext: async () => session },
    "@/lib/server/api-client": {
      ApiError: BackendError,
      api: { post: async (endpoint, body) => {
        calls.push({ endpoint, body });
        if (response instanceof Error) throw response;
        return response;
      } },
    },
  });
  return { actions, calls, tags, BackendError };
}

function apiFixture(fetchResponse) {
  const calls = [];
  const apiModule = loadModule("lib/server/api-client.ts", {
    "./auth-context": { getServerAuthContext: async () => ({ userId: "user-id", accessToken: "test-access-token" }) },
    "./token-refresh": {
      getValidAccessToken: async () => "test-access-token",
      markBackendSessionExpired: async () => {},
      refreshBackendAccessToken: async () => null,
    },
  }, { fetch: async (url, init) => { calls.push({ url, init }); return fetchResponse; } });
  return { ...apiModule, calls };
}

test("backend envelope is unwrapped and OTP is sent with bearer auth under /api", async () => {
  const challenge = { phone: "+447911123456", expiresInMinutes: 10, resendAvailableInSeconds: 60 };
  const { api, calls } = apiFixture(Response.json({ success: true, data: challenge }));
  const result = await api.post("/auth/phone/otp/send", { phone: "07911123456" });
  assert.deepEqual(result, challenge);
  assert.equal(calls[0].url, "https://backend.example/api/auth/phone/otp/send");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-access-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), { phone: "07911123456" });
});

test("backend validation messages and support reference survive API errors", async () => {
  const { api } = apiFixture(Response.json({ success: false, message: ["Invalid phone", "Use a country code"],
    data: null, meta: { requestId: "reference-from-meta" } }, { status: 400 }));
  await assert.rejects(() => api.post("/auth/phone/otp/send", {}), (error) => {
    assert.equal(error.message, "Invalid phone Use a country code");
    assert.equal(error.requestId, "reference-from-meta");
    assert.equal(error.status, 400);
    return true;
  });
});

test("request ID header is retained when provider errors have no metadata", async () => {
  const { api } = apiFixture(Response.json({ message: "SMS service is not configured" },
    { status: 503, headers: { "X-Request-Id": "sms-support-id" } }));
  await assert.rejects(() => api.post("/auth/phone/otp/send", {}), (error) => error.requestId === "sms-support-id");
});

test("phone send preserves UK input for backend normalization and returned cooldown", async () => {
  const challenge = { phone: "+447911123456", expiresInMinutes: 7, resendAvailableInSeconds: 90 };
  const { actions, calls } = actionsFixture("features/auth/phone-actions.ts", challenge);
  const result = await actions.sendPhoneOtpAction({ phone: " 07911123456 " });
  assert.equal(result.ok, true);
  assert.equal(result.data.resendAvailableInSeconds, 90);
  assert.equal(result.data.expiresInMinutes, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ endpoint: "/auth/phone/otp/send", body: { phone: "07911123456" } }]);
});

test("phone verification sends only the six-digit OTP and refreshes user snapshots", async () => {
  const user = { id: "user-id", phone: "+447911123456", phoneVerified: true };
  const { actions, calls, tags } = actionsFixture("features/auth/phone-actions.ts", user);
  const result = await actions.verifyPhoneOtpAction({ otp: "123456" });
  assert.equal(result.ok, true);
  assert.equal(result.data.phoneVerified, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ endpoint: "/auth/phone/otp/verify", body: { otp: "123456" } }]);
  assert.deepEqual(tags, ["auth", "auth:me", "settings", "onboarding"]);
});

test("phone verification rejects invalid codes and unauthenticated sends before the API", async () => {
  const { actions, calls } = actionsFixture("features/auth/phone-actions.ts", {}, null);
  for (const otp of ["12345", "1234567", "12a456"]) {
    assert.equal((await actions.verifyPhoneOtpAction({ otp })).ok, false);
  }
  assert.equal((await actions.sendPhoneOtpAction({ phone: "+447911123456" })).code, "SESSION_EXPIRED");
  assert.equal(calls.length, 0);
});

test("verification success requires the server to confirm a verified number", async () => {
  const { actions, tags } = actionsFixture("features/auth/phone-actions.ts", { id: "user-id", phone: "+447911123456", phoneVerified: false });
  assert.equal((await actions.verifyPhoneOtpAction({ otp: "123456" })).ok, false);
  assert.equal(tags.length, 0);
});

test("fixed invoices omit units and never send client-supplied rates or totals", async () => {
  const { actions, calls, tags } = actionsFixture("features/payments/actions.ts");
  const result = await actions.createInvoiceAction({ bookingId, poNumber: " PO-123 ", rateAmount: 1, totalAmountPence: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), { bookingId, poNumber: "PO-123" });
  assert.deepEqual(tags, ["invoices", "bookings"]);
});

test("hourly/daily invoice units accept fractional work and reject out-of-range precision", async () => {
  const { actions, calls } = actionsFixture("features/payments/actions.ts");
  for (const unitsWorked of [0, 0.001, -1, 10000, 4.555, NaN, Infinity]) {
    assert.equal((await actions.createInvoiceAction({ bookingId, unitsWorked })).ok, false);
  }
  assert.equal(calls.length, 0);
  assert.equal((await actions.createInvoiceAction({ bookingId, unitsWorked: 4.55 })).ok, true);
  assert.equal(calls[0].body.unitsWorked, 4.55);
});

test("invalid booking IDs and PO numbers cannot trigger Stripe invoices", async () => {
  const { actions, calls } = actionsFixture("features/payments/actions.ts");
  assert.equal((await actions.createInvoiceAction({ bookingId: "not-a-uuid" })).ok, false);
  assert.equal((await actions.createInvoiceAction({ bookingId, poNumber: "x".repeat(101) })).ok, false);
  assert.equal(calls.length, 0);
});

test("refund amounts remain integer pence and optional full refunds are supported", async () => {
  const { actions, calls } = actionsFixture("features/payments/actions.ts");
  for (const amountPence of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await actions.refundInvoiceAction({ id: invoiceId, amountPence })).ok, false);
  }
  assert.equal((await actions.refundInvoiceAction({ id: invoiceId, reason: "invalid" })).ok, false);
  assert.equal(calls.length, 0);
  assert.equal((await actions.refundInvoiceAction({ id: invoiceId, amountPence: 2000, reason: "requested_by_customer" })).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), { amountPence: 2000, reason: "requested_by_customer" });
  assert.equal((await actions.refundInvoiceAction({ id: invoiceId })).ok, true);
});

test("invoice totals use pence while rates stay pounds and private statuses stay admin-only", () => {
  const schemas = loadModule("features/payments/schemas.ts");
  const result = schemas.normalizeInvoice(invoice());
  assert.equal(result.rateAmount, 180);
  assert.equal(result.totalAmountPence, 91125);
  assert.equal(schemas.formatPence(result.totalAmountPence), "£911.25");
  assert.equal(schemas.normalizeInvoicesQuery({ status: "PENDING", page: 1.9, limit: 150 }).status, undefined);
  assert.equal(schemas.normalizeInvoicesQuery({ page: 1.9, limit: 150 }).page, 1);
  assert.equal(schemas.normalizeInvoicesQuery({ page: 1.9, limit: 150 }).limit, 100);
  assert.equal(schemas.normalizeAdminInvoicesQuery({ status: "PENDING", bookingId }).status, "PENDING");
});

test("paid invoice evidence wins over stale or lower-case payment statuses", () => {
  const paymentSchemas = loadModule("features/payments/schemas.ts");
  const bookingSchemas = loadModule("features/bookings/schemas.ts");
  const paidAt = "2026-10-05T10:00:00.000Z";

  assert.equal(paymentSchemas.normalizeInvoice({ ...invoice(), status: "paid" }).status, "PAID");
  assert.equal(paymentSchemas.normalizeInvoice({ ...invoice(), status: "OPEN", paidAt }).status, "PAID");

  const booking = bookingSchemas.normalizeBooking({
    id: bookingId,
    applicationId: "application-id",
    status: "COMPLETED",
    job: { id: "job-id", title: "Maths cover", keyStages: [] },
    institution: { id: "school-id", name: "School" },
    instructor: { id: "teacher-id", fullName: "Teacher" },
    invoice: { id: invoiceId, status: "open", paidAt, totalAmountPence: 12320 },
  });
  assert.equal(booking.invoice.status, "PAID");
  assert.equal(booking.invoice.paidAt, paidAt);
});

test("booking filters are normalized for the paginated API", () => {
  const schemas = loadModule("features/bookings/schemas.ts");
  const normalized = schemas.normalizeBookingsQuery({
    from: " 2026-10-01 ",
    invoice: "unpaid",
    jobId: " job-id ",
    limit: 150,
    page: 0,
    search: `  ${"maths".repeat(30)}  `,
    status: "COMPLETED",
    to: " 2026-10-31 ",
  });

  assert.equal(normalized.from, "2026-10-01");
  assert.equal(normalized.invoice, "unpaid");
  assert.equal(normalized.jobId, "job-id");
  assert.equal(normalized.limit, 100);
  assert.equal(normalized.page, 1);
  assert.equal(normalized.search.length, 100);
  assert.equal(normalized.status, "COMPLETED");
  assert.equal(normalized.to, "2026-10-31");
  assert.equal(schemas.normalizeBookingsQuery({ invoice: "overdue" }).invoice, undefined);
});

test("public marketplace profiles expose normalized safe fields", () => {
  const schemas = loadModule("features/public-profiles/schemas.ts");
  const instructor = schemas.normalizeInstructorPublicProfile({
    id: "teacher-profile-id", fullName: "Teacher", subjects: ["Maths", ""], skills: [], keyStages: [],
    ratingAverage: "4.75", ratingCount: "8", dbsVerified: true, dailyRate: "180", memberSince: "2026-01-01",
  });
  const institution = schemas.normalizeInstitutionPublicProfile({
    id: "school-profile-id", name: "Oak School", institutionType: "MAT_SCHOOL", coverTypes: ["DAILY"],
    trust: { name: "Oak Trust" }, typicalPupilCount: "420", verified: true,
  });

  assert.deepEqual(Array.from(instructor.subjects), ["Maths"]);
  assert.equal(instructor.dailyRate, 180);
  assert.equal(instructor.ratingAverage, 4.75);
  assert.equal(institution.institutionType, "MAT_SCHOOL");
  assert.equal(institution.trust.name, "Oak Trust");
  assert.equal(institution.typicalPupilCount, 420);
});

test("profile reviews use the API pagination total", () => {
  const schemas = loadModule("features/reviews/schemas.ts");
  const result = schemas.normalizeProfileReviews({
    pagination: { page: 1, limit: 2, total: 7, totalPages: 4, hasNextPage: true },
    reviews: [
      { id: "review-1", rating: 5, reviewerName: "Oak School" },
      { id: "review-2", rating: 4, reviewerName: "Elm School" },
    ],
  });

  assert.equal(result.total, 7);
  assert.equal(result.averageRating, 4.5);
  assert.equal(result.reviews.length, 2);
});

test("job responses retain the safe institution profile identity", () => {
  const schemas = loadModule("features/jobs/schemas.ts");
  const job = schemas.normalizeBackendJob({
    id: "job-id",
    postedByUserId: "private-user-id",
    institution: { id: "school-profile-id", imageUrl: "https://images.example/school.jpg", name: "Oak School" },
    title: "Maths cover",
    description: "Cover role",
    status: "ACTIVE",
  });

  assert.equal(job.school, "Oak School");
  assert.equal(job.institution.id, "school-profile-id");
  assert.equal(job.institution.imageUrl, "https://images.example/school.jpg");
  assert.notEqual(job.institution.id, job.postedByUserId);
});

test("worked time stays within inclusive booking dates even across a UK clock change", () => {
  const { bookingDays, invoiceUnitsLimit } = loadModule("features/bookings/schemas.ts");
  const daily = { startDate: "2026-10-24T00:00:00.000Z", endDate: "2026-10-26T00:00:00.000Z", payType: "daily" };
  assert.equal(bookingDays(daily), 3);
  assert.equal(invoiceUnitsLimit(daily), 3);
  assert.equal(invoiceUnitsLimit({ ...daily, payType: "hourly" }), 72);
  assert.equal(invoiceUnitsLimit({ payType: "hourly" }), 9999.99);
  assert.equal(bookingDays({ ...daily, endDate: "2026-10-23T00:00:00.000Z" }), null);
});

test("hosted Stripe invoice and PDF links reject executable or lookalike URLs", () => {
  const { stripeInvoiceUrl } = loadModule("features/payments/invoice-links.ts");
  assert.equal(stripeInvoiceUrl("https://invoice.stripe.com/i/test"), "https://invoice.stripe.com/i/test");
  assert.equal(stripeInvoiceUrl("https://pay.stripe.com/invoice/test"), "https://pay.stripe.com/invoice/test");
  for (const url of ["javascript:alert(1)", "http://invoice.stripe.com/i/test",
    "https://stripe.com.evil.example/invoice", "https://user:pass@invoice.stripe.com/i/test"]) {
    assert.equal(stripeInvoiceUrl(url), undefined);
  }
});

test("administrator payout support is visible on Payments while confirmation dialogs are closed", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const emptyQuery = { data: { invoices: [], pagination: { page: 1, totalPages: 0, total: 0 } },
    error: null, isLoading: false, isFetching: false, refetch: () => {} };
  const element = (tag) => ({ children }) => React.createElement(tag, null, children);
  const { BillingPage } = loadModule("components/organisms/BillingPage.tsx", {
    "next/navigation": { useSearchParams: () => new URLSearchParams() },
    "@/features/payments/use-payments": {
      useAllInvoices: () => emptyQuery, useMyInvoices: () => emptyQuery,
      useResendInvoice: () => ({}), useRefundInvoice: () => ({}), useVoidInvoice: () => ({}),
    },
    "../atoms": { Btn: element("button"), Tag: element("span"), Stat: ({ label }) => React.createElement("div", null, label), buttonClassName: () => "" },
    "../molecules": { Modal: ({ open, children }) => open ? React.createElement("div", null, children) : null,
      PageHead: ({ title }) => React.createElement("h1", null, title), SectionLoader: () => null },
    "./PayInvoiceModal": { PayInvoiceModal: () => null, usePaymentReturn: () => {} },
    "./InvoiceDetailsModal": { InvoiceDetailsModal: () => null },
    "./PayoutSettings": { PayoutSettings: () => null },
    "./AdminPayoutLookup": { AdminPayoutLookup: () => React.createElement("h2", null, "Instructor payout status") },
  });
  const markup = renderToStaticMarkup(React.createElement(BillingPage, { role: "admin", toast: () => {} }));
  assert.match(markup, /Instructor payout status/);
  assert.match(markup, /Booking ID/);
  assert.doesNotMatch(markup, /Void this invoice\?/);
});
