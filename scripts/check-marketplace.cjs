const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args);
};
for (const ext of [".ts", ".tsx"])
  require.extensions[ext] = (module, filename) => {
    let source = fs.readFileSync(filename, "utf8");
    if (filename.endsWith("PostJobPage.tsx"))
      source += "\nexport { initialForm, toJobCreateInput, validateOptionalJobFields, toFormState };";
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    module._compile(result.outputText, filename);
  };
const { toCreateJobPayload, toUpdateJobPayload, normalizeBackendJob } = require("../features/jobs/schemas.ts");
const { applicationTransitions } = require("../features/applications/status.ts");
const { normalizeApplicationCreateInput } = require("../features/applications/schemas.ts");
const { isProfileVerified, profileEntryStatus } = require("../features/onboarding/profile-progress.ts");
const { formatJobPay, displayedJobStatus } = require("../features/jobs/presentation.ts");
const create = toCreateJobPayload({
  title: "  Cover  ",
  description: "  Teach  ",
  keyStages: [],
  status: "ACTIVE",
  institutionId: "wrong-id",
  currency: "GBP",
  requiredSkills: [" SEN ", "SEN"],
  payAmount: 0,
});
assert.equal(create.title, "Cover");
assert.equal(create.description, "Teach");
assert.equal(create.payAmount, 0);
assert.deepEqual(create.requiredSkills, ["SEN"]);
for (const key of ["status", "institutionId", "currency"]) assert.equal(key in create, false);
assert.equal(toCreateJobPayload({ title: "Cover", description: "Teach" }).title, "Cover");
const update = toUpdateJobPayload({
  id: "job",
  requiredSkills: [],
  keyStages: [],
  documentRequirementIds: ["not-writable"],
  status: "CLOSED",
});
assert.deepEqual(update, { requiredSkills: [], keyStages: [], status: "CLOSED" });
assert.deepEqual(normalizeApplicationCreateInput({ jobId: " job ", coverLetter: " " }), {
  jobId: "job",
  coverLetter: undefined,
});
assert.deepEqual(applicationTransitions.APPLIED, ["VIEWED", "SHORTLISTED", "REJECTED"]);
assert.deepEqual(applicationTransitions.HIRED, ["COMPLETED"]);
assert.deepEqual(applicationTransitions.REJECTED, []);
assert.deepEqual(applicationTransitions.COMPLETED, []);
for (const [role, profile] of [
  ["teacher", "instructor"],
  ["institution", "institution"],
  ["individual", "recruiter"],
]) {
  const snapshot = {
    role,
    [profile]: { id: "profile" },
    applicationStatus: "approved",
    user: { emailVerified: true, phoneVerified: true },
    documentRequirements: [],
    requirementDocuments: {},
  };
  assert.equal(isProfileVerified(snapshot), false, "The server must explicitly grant full verification");
  assert.equal(isProfileVerified({ ...snapshot, user: { ...snapshot.user, isFullyVerified: true } }), true);
  assert.equal(profileEntryStatus({ ...snapshot, applicationStatus: "suspended" }), "suspended");
  assert.equal(profileEntryStatus({ ...snapshot, applicationStatus: "rejected" }), "rejected");
  assert.equal(profileEntryStatus({ ...snapshot, applicationStatus: "deactivated" }), "deactivated");
}
const job = normalizeBackendJob({
  id: "job",
  postedByUserId: "owner",
  title: "Cover",
  description: "Teach",
  status: "ACTIVE",
  payAmount: null,
  expiresAt: "2020-01-01T00:00:00Z",
});
assert.equal(job.payAmount, null);
assert.equal(formatJobPay(job), "Pay not specified");
assert.equal(formatJobPay({ ...job, payAmount: 0, payType: "hourly" }), "GBP 0/hour");
assert.equal(displayedJobStatus(job), "EXPIRED");

// Render real page components with controlled API hook responses to exercise role/verification gates.
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const load = Module._load;
const liveJob = { ...job, status: "ACTIVE", expiresAt: null };
let existingApplication = null;
let requirementsEnabled;
const mockQuery = (data) => ({ data, isSuccess: true, isLoading: false, isError: false, refetch: async () => {} });
let sessionToken = null;
const instructorProfile = {
  id: "instructor",
  fullName: "Alex Teacher",
  bio: "Experienced instructor",
  imageUrl: "https://example.test/saved-profile.jpg",
  address: "1 School Road",
  city: "London",
  county: "London",
  postalCode: "SW1A 2AA",
  countryCode: "GB",
  currency: "GBP",
  dailyRate: "200",
  hourlyRate: "25",
  experience: "5",
  maxTravelDistance: "15",
  skills: ["SEN"],
  subjects: ["Maths"],
  keyStages: ["KS2"],
};
const settingsSnapshot = {
  role: "teacher",
  instructor: instructorProfile,
  user: { name: "Alex Teacher", email: "alex@example.test", phone: "+447700900123" },
};
Module._load = function (request, ...args) {
  if (request === "next-auth/jwt") return { getToken: async () => sessionToken };
  if (request === "next/server")
    return {
      NextResponse: {
        next: () => ({ kind: "next" }),
        redirect: (url) => ({ kind: "redirect", pathname: url.pathname }),
      },
    };
  if (request === "@/features/jobs/use-jobs")
    return {
      useJob: () => mockQuery(liveJob),
      useMyJobs: () => mockQuery([]),
      useCreateJob: () => ({}),
      useUpdateJob: () => ({}),
    };
  if (request === "@/features/applications/use-applications")
    return { useCreateApplication: () => ({ isPending: false, mutate: () => {} }) };
  if (request === "@/features/matching/use-matching") return { useJobMatchScore: () => mockQuery(null) };
  if (request === "@/features/document-requirements/use-document-requirements")
    return {
      useApplicationDocumentRequirements: (enabled) => {
        requirementsEnabled = enabled;
        return mockQuery([]);
      },
    };
  if (request === "@/features/settings/use-settings")
    return {
      useSettingsProfile: () => mockQuery(settingsSnapshot),
      useUpdateSettings: () => ({ isPending: false }),
      useUploadSettingsProfileImage: () => ({ isPending: false }),
    };
  if (request === "@tanstack/react-query")
    return {
      useQuery: () => mockQuery(existingApplication),
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
    };
  if (request === "../molecules")
    return {
      PageHead: ({ title, subtitle }) => React.createElement("header", null, title, subtitle),
      SectionLoader: () => null,
      FormattedJobDescription: ({ description }) => React.createElement("p", null, description),
      Modal: ({ open, children }) => (open ? children : null),
      MatchScorePanel: () => null,
      TagInput: () => React.createElement("input"),
    };
  return load.call(this, request, ...args);
};
const { JobDetailPage } = require("../components/organisms/JobDetailPage.tsx");
const {
  PostJobPage,
  initialForm,
  toJobCreateInput,
  validateOptionalJobFields,
  toFormState,
} = require("../components/organisms/PostJobPage.tsx");
const { ApplicationForm } = require("../components/organisms/ApplicationForm.tsx");
const completeForm = {
  ...initialForm,
  title: "Maths cover",
  description: "Teach KS2",
  address: "1 School Road",
  city: "London",
  county: "London",
  postalCode: "SW1A 2AA",
  countryCode: "GB",
  latitude: "0",
  longitude: "-0.14",
  minExperienceYears: "0",
  requiredSkills: ["SEN"],
  keyStages: ["KS2"],
  subject: "Maths",
  payAmount: "0",
  payType: "hourly",
  parkingInfo: "Reception",
  startDate: "2027-01-01",
  endDate: "2027-01-02",
  expiresAt: "2026-12-31",
  documentRequirementIds: ["requirement"],
  urgent: true,
  qtsRequired: true,
};
assert.deepEqual(validateOptionalJobFields(completeForm), {});
const completePayload = toJobCreateInput(completeForm, "brief", "ACTIVE");
for (const field of [
  "title",
  "description",
  "subject",
  "requiredSkills",
  "minExperienceYears",
  "address",
  "city",
  "county",
  "postalCode",
  "countryCode",
  "latitude",
  "longitude",
  "startDate",
  "endDate",
  "keyStages",
  "parkingInfo",
  "payAmount",
  "payType",
  "expiresAt",
  "documentRequirementIds",
])
  assert.notEqual(completePayload[field], undefined, `Job form includes ${field}`);
assert.equal(completePayload.latitude, 0);
assert.equal(completePayload.payAmount, 0);
assert.match(completePayload.description, /Posting route: Open brief/);
assert.match(completePayload.description, /QTS requested/);
assert.match(completePayload.description, /Marked urgent/);
assert.ok(validateOptionalJobFields({ ...completeForm, longitude: "" }).longitude);
assert.ok(validateOptionalJobFields({ ...completeForm, latitude: "91" }).latitude);
assert.ok(validateOptionalJobFields({ ...completeForm, longitude: "-181" }).longitude);
const editForm = toFormState({ ...liveJob, ...completePayload });
assert.equal(editForm.latitude, "0");
assert.equal(editForm.description, "Teach KS2");
assert.equal(editForm.qtsRequired, true);
assert.equal(editForm.urgent, true);
const applicationHtml = renderToStaticMarkup(
  React.createElement(ApplicationForm, {
    jobTitle: "Maths cover",
    pending: false,
    canApply: true,
    onCancel: () => {},
    onSubmit: () => {},
    onBusyChange: () => {},
  }),
);
assert.doesNotMatch(applicationHtml, /type="file"/);
assert.match(applicationHtml, /saved-profile\.jpg/);
for (const label of [
  "Full name",
  "About you",
  "Profile photo",
  "Subjects",
  "Key stages",
  "Skills",
  "Maximum travel distance (miles)",
  "Teaching experience (years)",
  "Hourly rate",
  "Daily rate",
  "Rate currency",
  "Address",
  "City",
  "County",
  "Postcode",
  "Country code",
  "Cover letter (optional)",
])
  assert.ok(applicationHtml.includes(label), `Application form exposes ${label}`);
for (const value of ["Alex Teacher", "15", "SW1A 2AA", "200"])
  assert.ok(applicationHtml.includes(`value="${value}"`), `Prefills ${value}`);
const props = { ctx: { jobId: "job" }, go: () => {}, toast: () => {} };
for (const role of ["teacher", "institution", "individual"]) {
  const html = renderToStaticMarkup(
    React.createElement(JobDetailPage, { ...props, role, state: { isFullyVerified: false } }),
  );
  assert.match(html, /About this role/);
  if (role === "teacher") assert.match(html, /disabled=""[^>]*><span>Full verification required/);
  else assert.match(html, /Applications are open to fully verified instructors/);
}
for (const role of ["institution", "individual"]) {
  const html = renderToStaticMarkup(
    React.createElement(PostJobPage, { ...props, ctx: {}, role, state: { isFullyVerified: false } }),
  );
  assert.match(html, /Full verification is required/);
  assert.doesNotMatch(html, /Publish job/);
}
for (const role of ["institution", "individual"]) {
  const html = renderToStaticMarkup(
    React.createElement(PostJobPage, { ...props, ctx: {}, role, state: { isFullyVerified: true } }),
  );
  assert.match(html, /How do you want to staff this role/);
  assert.equal(
    requirementsEnabled,
    role === "institution",
    "Hirers must not request the institution-only requirement catalogue",
  );
}
let html = renderToStaticMarkup(
  React.createElement(JobDetailPage, { ...props, role: "teacher", state: { isFullyVerified: true } }),
);
assert.match(html, />Apply for job<\/span><\/button>/);
existingApplication = { id: "application" };
html = renderToStaticMarkup(
  React.createElement(JobDetailPage, { ...props, role: "teacher", state: { isFullyVerified: true } }),
);
assert.match(html, /disabled=""[^>]*><span>Application submitted/);
console.log(
  "Marketplace checks passed: strict payloads, transitions, all three profile states, pay/expiry, browse/post/apply verification gates and duplicate applications.",
);

const { proxy } = require("../proxy.ts");
const { getAuthenticatedEntryHref } = require("../lib/routes.ts");
const requestFor = (pathname) => ({ nextUrl: { pathname, clone: () => ({ pathname, search: "" }) } });
(async () => {
  for (const token of [
    null,
    { sub: "user", appEmailVerified: false },
    { sub: "user", appEmailVerified: true, role: null },
  ]) {
    sessionToken = token;
    for (const pathname of ["/find-jobs", "/job-detail"])
      assert.equal((await proxy(requestFor(pathname))).kind, "next");
  }
  for (const role of ["teacher", "institution", "individual"]) {
    for (const applicationStatus of ["none", "pending_review", "approved", "rejected", "suspended", "deactivated"]) {
      sessionToken = { sub: "user", appEmailVerified: true, role, applicationStatus };
      assert.equal((await proxy(requestFor("/dashboard"))).kind, "next");
      assert.equal(getAuthenticatedEntryHref({ role, applicationStatus }), "/dashboard");
    }
  }
  sessionToken = null;
  assert.equal((await proxy(requestFor("/post-job"))).pathname, "/login");
  sessionToken = { sub: "user", appEmailVerified: true, role: null };
  assert.equal((await proxy(requestFor("/dashboard"))).pathname, "/onboarding");
  console.log(
    "Routing checks passed: public discovery, incomplete-profile workspace access, and protected-route authentication.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
