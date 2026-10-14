const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function load(file, exposed = []) {
  const loadedModule = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), "utf8") + (exposed.length ? `\nexport { ${exposed.join(", ")} };` : "");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, fileName: file }).outputText;
  vm.runInNewContext(compiled, { module: loadedModule, exports: loadedModule.exports, URL, require(name) {
    if (name === "@/lib/uk-validation") return load("lib/uk-validation.ts");
    if (name === "@/features/applications/rich-text") return load("features/applications/rich-text.ts");
    if (["react", "react/jsx-runtime", "country-state-city", "libphonenumber-js/max"].includes(name)) return require(name);
    return {};
  }});
  return loadedModule.exports;
}
const jobs = load("components/organisms/PostJobPage.tsx", ["validateStep", "validateAll", "validateDraft", "toJobCreateInput", "initialForm"]);
const directory = load("components/organisms/FindTeachersPage.tsx", ["validateDirectoryFilters", "emptyFilters"]);
const bookings = load("components/organisms/BookingsPage.tsx", ["validateCancellationReason", "validateBookingReview"]);
const links = load("components/molecules/ProposalEditor.tsx", ["normalizeLink"]);
const validJob = () => ({ ...jobs.initialForm, title: "Primary teacher", description: "Support an inclusive primary classroom.", city: "Belfast", postalCode: "bt1 5gs", countryCode: "GB" });

test("job wizard, draft and publication all reject foreign or invalid saved location fields", () => {
  for (const [key, value] of [["countryCode", "US"], ["city", "Toronto"], ["county", "California"], ["postalCode", "90210"]]) {
    const form = { ...validJob(), [key]: value };
    for (const validate of [form => jobs.validateStep(2, form), jobs.validateDraft, jobs.validateAll]) {
      assert.ok(validate(form)[key], key);
      assert.equal(form.title, "Primary teacher", "validation preserves other values");
      assert.equal(form[key], value, "invalid stored values remain visible for correction");
    }
    const corrected = validJob();
    assert.equal(jobs.validateAll(corrected)[key], undefined);
  }
});

test("job payload normalizes UK values while optional empty location fields remain valid", () => {
  const form = { ...validJob(), countryCode: "United Kingdom", city: "belfast", postalCode: "bT15Gs" };
  assert.equal(Object.keys(jobs.validateAll(form)).length, 0);
  const payload = jobs.toJobCreateInput(form, "instant", "DRAFT");
  assert.equal(payload.countryCode, "GB");
  assert.equal(payload.city, "Belfast");
  assert.equal(payload.postalCode, "BT1 5GS");
  assert.equal(Object.keys(jobs.validateAll({ ...validJob(), city: "", postalCode: "", county: "" })).length, 0);
});

test("job transitions reject required omissions, invalid dates and invalid numeric inputs", () => {
  assert.ok(jobs.validateStep(2, { ...validJob(), title: " " }).title);
  assert.ok(jobs.validateStep(2, { ...validJob(), description: "short" }).description);
  assert.ok(jobs.validateStep(2, { ...validJob(), startDate: "2099-02-30" }).startDate);
  assert.ok(jobs.validateStep(2, { ...validJob(), payAmount: "Infinity" }).payAmount);
  assert.ok(jobs.validateStep(2, { ...validJob(), minExperienceYears: "1.5" }).minExperienceYears);
  assert.ok(jobs.validateStep(3, { ...validJob(), parkingInfo: "x".repeat(1001) }).parkingInfo);
});

test("directory filters accept all four UK nations and reject structured foreign towns and invalid numbers", () => {
  for (const city of ["London", "Edinburgh", "Cardiff", "Belfast"]) assert.equal(Object.keys(directory.validateDirectoryFilters({ ...directory.emptyFilters, city })).length, 0);
  assert.ok(directory.validateDirectoryFilters({ ...directory.emptyFilters, city: "Paris" }).city);
  assert.ok(directory.validateDirectoryFilters({ ...directory.emptyFilters, maxDailyRate: "-1" }).maxDailyRate);
  assert.ok(directory.validateDirectoryFilters({ ...directory.emptyFilters, minExperience: "1.5" }).minExperience);
  assert.ok(directory.validateDirectoryFilters({ ...directory.emptyFilters, minRating: "6" }).minRating);
  assert.equal(Object.keys(directory.validateDirectoryFilters({ ...directory.emptyFilters, search: "Paris teaching experience" })).length, 0, "general search is not a location field");
});

test("booking cancellation and review validators enforce the rules independently of button state", () => {
  assert.ok(bookings.validateCancellationReason("   "));
  assert.ok(bookings.validateCancellationReason("x".repeat(1001)));
  assert.equal(bookings.validateCancellationReason("The timetable changed."), undefined);
  for (const rating of [0, 6, 2.5, NaN]) assert.ok(bookings.validateBookingReview(rating, ""));
  assert.ok(bookings.validateBookingReview(5, "x".repeat(2001)));
  assert.equal(bookings.validateBookingReview(4, ""), undefined, "review comment remains optional");
});

test("proposal link dialog rejects invalid schemes and malformed email links", () => {
  for (const value of ["", "javascript:alert(1)", "mailto:no-email", "https://bad host.test"]) assert.equal(links.normalizeLink(value), null, value);
  assert.equal(links.normalizeLink("example.test/path"), "https://example.test/path");
  assert.equal(links.normalizeLink("mailto:teacher@example.test"), "mailto:teacher@example.test");
  assert.equal(links.normalizeLink("teacher@example.test"), "mailto:teacher@example.test");
});
