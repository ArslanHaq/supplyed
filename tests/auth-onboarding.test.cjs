const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

// Load the app's TypeScript helpers without starting Next or adding a runner.
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = name => {
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const target = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
    const resolved = [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts"), path.join(target, "index.tsx")]
      .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!resolved) throw new Error(`Cannot resolve ${name}`);
    return load(resolved);
  };
  new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { resolvePostcodeLocation } = load("lib/postcode-location.ts");
const { ApiError } = load("lib/server/api-error.ts");
const { actionError } = load("lib/server/action-response.ts");
const { createInitialForm, buildOnboardingPayload } = load("components/organisms/onboarding/utils.ts");
const { validateOnboardingStep } = load("components/organisms/onboarding/validation.ts");
const { validateOnboardingForm } = load("features/onboarding/validation.ts");
const { jobDescriptionForDisplay } = load("features/jobs/description.ts");
const { shouldShowInstantMatches } = load("features/jobs/post-publish.ts");
const option = (value, label = value, aliases = [], isActive = true) => ({ value, label, aliases, isActive });

test("invalid login credentials survive API and action error handling", () => {
  const error = new ApiError("Invalid email or password", 401);
  const result = actionError(error.message, { status: error.status });
  assert.equal(result.message, "Invalid email or password.");
  assert.equal(result.status, 401);
  assert.equal(result.ok, false);
});

test("expired sessions still request sign-in", () => {
  const error = new ApiError("Unauthorized", 401, undefined, "SESSION_EXPIRED");
  assert.equal(actionError(error.message, { status: error.status, code: error.code }).message,
    "Your session expired. Sign in again to continue.");
});

test("document verification failures stay actionable through API and action errors", () => {
  const code = "INSTRUCTOR_DOCUMENTS_NOT_VERIFIED";
  const error = new ApiError("Forbidden", 403, undefined, code);
  const result = actionError(error.message, { status: error.status, code: error.code });
  assert.equal(result.code, code);
  assert.equal(result.status, 403);
  assert.match(result.message, /uploaded, current and approved/);
  assert.match(result.message, /pending reviews/);
});

test("job descriptions retain rich text but hide internal posting flags", () => {
  const richDescription = "<p><strong>Year 6 cover</strong></p><ul><li>Teach mathematics</li></ul>\n\nPosting route: Instant matching.\n\nQTS requested.";
  const display = jobDescriptionForDisplay(richDescription);
  assert.match(display, /<strong>Year 6 cover<\/strong>/);
  assert.match(display, /<ul><li>Teach mathematics<\/li><\/ul>/);
  assert.doesNotMatch(display, /Posting route|QTS requested/);
});

test("job descriptions preserve long user text for safe visual wrapping", () => {
  const longWord = "role".repeat(300);
  assert.equal(jobDescriptionForDisplay(longWord), longWord);
});

test("only a newly published instant job opens proactive teacher matches", () => {
  assert.equal(shouldShowInstantMatches({ jobType: "INSTANT", status: "ACTIVE" }, false), true);
  assert.equal(shouldShowInstantMatches({ jobType: "BRIEF", status: "ACTIVE" }, false), false);
  assert.equal(shouldShowInstantMatches({ jobType: "INSTANT", status: "DRAFT" }, false), false);
  assert.equal(shouldShowInstantMatches({ jobType: "INSTANT", status: "ACTIVE" }, true), false);
});

test("postcode matches labels and aliases but returns exact catalogue values", () => {
  assert.deepEqual(resolvePostcodeLocation(
    { bua: "Manchester", admin_county: "Greater Manchester" },
    [option("manchester-city", "Manchester")],
    [option("greater-manchester", "County", ["Greater Manchester"])],
  ), { countryCode: "GB", city: "manchester-city", county: "greater-manchester" });
});

test("settlement takes precedence over a broader council district", () => {
  assert.equal(resolvePostcodeLocation({ bua: "Hextable", admin_district: "Sevenoaks" },
    [option("Sevenoaks"), option("Hextable")], []).city, "Hextable");
});

test("London boroughs resolve to London and Northern Ireland resolves to GB", () => {
  assert.equal(resolvePostcodeLocation({ region: "London", admin_district: "Westminster" },
    [option("Westminster"), option("London")], []).city, "London");
  assert.deepEqual(resolvePostcodeLocation({ admin_district: "Belfast" }, [option("Belfast")], []),
    { countryCode: "GB", city: "Belfast", county: "" });
});

test("unmatched or inactive towns are not invented or selected", () => {
  assert.equal(resolvePostcodeLocation({ bua: "Retired town", region: "South East" },
    [option("Retired town", "Retired town", [], false), option("South East")], []).city, "");
  assert.equal(resolvePostcodeLocation({ parish: "Leeds, unparished area" }, [option("Leeds")], []).city, "Leeds");
});

test("teacher address loads and round-trips through onboarding FormData", () => {
  const form = createInitialForm("teacher@example.com", { instructor: { address: "12 Example Road" } });
  assert.equal(form.profileAddress, "12 Example Road");
  form.profileAddress = "  15 New Street  ";
  assert.equal(buildOnboardingPayload(form, "teacher", 1).get("profileAddress"), "15 New Street");
  form.profileAddress = "";
  assert.equal(buildOnboardingPayload(form, "teacher", 1).get("profileAddress"), "");
});

test("teacher address is optional and limited to the backend's 250 characters", () => {
  const form = createInitialForm();
  assert.equal(validateOnboardingStep(form, "teacher", 1).profileAddress, undefined);
  assert.equal(validateOnboardingForm(buildOnboardingPayload(form, "teacher", 1)).profileAddress, undefined);
  form.profileAddress = "x".repeat(251);
  assert.ok(validateOnboardingStep(form, "teacher", 1).profileAddress);
  assert.ok(validateOnboardingForm(buildOnboardingPayload(form, "teacher", 1)).profileAddress);
});

const { waitingForInstitutionApproval } = load("features/onboarding/institution-approval.ts");
const { profileEntryStatus } = load("features/onboarding/profile-progress.ts");
const approved = { status: "APPROVED" };

test("MAT requires signatory approval and single schools require compliance approval", () => {
  assert.equal(waitingForInstitutionApproval({ institutionType: "MAT_SCHOOL" }, null, approved), true);
  assert.equal(waitingForInstitutionApproval({ institutionType: "MAT_SCHOOL" }, approved, null), false);
  assert.equal(waitingForInstitutionApproval({ institutionType: "SINGLE_SCHOOL" }, approved, null), true);
  assert.equal(waitingForInstitutionApproval({ institutionType: "SINGLE_SCHOOL" }, null, approved), false);
  for (const status of ["PENDING", "DECLINED", "EXPIRED", "REVOKED"]) {
    assert.equal(waitingForInstitutionApproval({ institutionType: "SINGLE_SCHOOL" }, null, { status }), true);
  }
});

test("existing submitted and active single schools keep their existing routing", () => {
  for (const applicationStatus of ["pending_review", "approved", "suspended"]) {
    assert.equal(profileEntryStatus({
      applicationStatus, role: "institution", documentRequirements: [], requirementDocuments: {},
      institution: { id: "existing", institutionType: "SINGLE_SCHOOL", complianceApprovalRequired: false },
    }), applicationStatus);
  }
  assert.equal(profileEntryStatus({
    applicationStatus: "pending_review", role: "institution", documentRequirements: [], requirementDocuments: {},
    institution: { id: "new", institutionType: "SINGLE_SCHOOL", complianceApprovalRequired: true },
  }), "none");
});

test("MAT validation ignores hidden compliance fields and its payload omits them", () => {
  const form = { ...createInitialForm(), institutionType: "MAT_SCHOOL", email: "owner@example.com", signatoryName: "Trust Lead", signatoryEmail: "trust@example.com", signatoryJobTitle: "Director", safeguardingConfirmed: true };
  assert.deepEqual(validateOnboardingStep(form, "institution", 3), {});
  form.complianceEmail = "invalid hidden email";
  const data = buildOnboardingPayload(form, "institution", 3);
  assert.equal(data.has("complianceEmail"), false);
  assert.equal(data.has("complianceContact"), false);
  const errors = validateOnboardingForm(data);
  assert.equal(errors.complianceEmail, undefined);
  assert.equal(errors.complianceContact, undefined);
});

test("single-school validation requires an independent compliance contact", () => {
  const form = { ...createInitialForm(), email: "owner@example.com", complianceContact: "Lead", complianceEmail: " OWNER@EXAMPLE.COM ", safeguardingConfirmed: true };
  assert.match(validateOnboardingStep(form, "institution", 3).complianceEmail, /someone other/);
  assert.match(validateOnboardingForm(buildOnboardingPayload(form, "institution", 3)).complianceEmail, /someone other/);
  form.complianceEmail = "lead@example.com";
  assert.deepEqual(validateOnboardingStep(form, "institution", 3), {});
  const data = buildOnboardingPayload(form, "institution", 3);
  assert.equal(data.has("signatoryEmail"), false);
  assert.equal(validateOnboardingForm(data).signatoryEmail, undefined);
});

test("rendered onboarding shows only the school type's approval contact fields", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { InstitutionComplianceStep } = load("components/organisms/onboarding/steps/InstitutionComplianceStep.tsx");
  const render = institutionType => renderToStaticMarkup(React.createElement(InstitutionComplianceStep, {
    controller: { form: { ...createInitialForm(), institutionType }, errors: {}, updateField() {} },
  }));
  const mat = render("MAT_SCHOOL");
  assert.match(mat, /Signatory email/);
  assert.doesNotMatch(mat, /Compliance email|Compliance lead/);
  const single = render("SINGLE_SCHOOL");
  assert.match(single, /Compliance email/);
  assert.doesNotMatch(single, /Signatory email|Signatory job title/);
});
