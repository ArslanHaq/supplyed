const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("authentication forms use a main landmark without changing the auth layout class", () => {
  for (const file of [
    "components/organisms/LoginPage.tsx",
    "components/organisms/SignupAccessPage.tsx",
    "components/organisms/ForgotPasswordRouteClient.tsx",
    "components/organisms/SignupVerifyPage.tsx",
    "components/organisms/TwoFactorChallengePage.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /<main className="auth-main">/);
    assert.doesNotMatch(source, /<section className="auth-main">/);
  }
});

test("workspace profiles keep the app shell as the single main landmark", () => {
  for (const file of [
    "components/organisms/InstitutionProfilePage.tsx",
    "components/organisms/PublicTeacherProfilePage.tsx",
  ]) {
    assert.doesNotMatch(read(file), /<main\b/);
  }
});

test("founding supporting content is a labelled section inside the main article", () => {
  const source = read("components/organisms/FoundingInterestPage.tsx");
  assert.match(source, /<section aria-labelledby="founding-marketplace-heading" className="marketing-founding-aside">/);
  assert.doesNotMatch(source, /<aside className="marketing-founding-aside">/);
});

test("reusable empty and missing-context states preserve heading order", () => {
  assert.match(read("components/organisms/WorkspacePanels.tsx"), /<h2>\{title\}<\/h2>/);
  assert.match(read("components/molecules/TeacherBookingDates.tsx"), /<h2[^>]*>.*Confirmed bookings.*<\/h2>/s);

  const jobDetail = read("components/organisms/JobDetailPage.tsx");
  assert.match(jobDetail, /<h1 className="font-heading text-\[26px\]">Choose a job<\/h1>/);
  assert.match(jobDetail, /<h1 className="font-heading text-\[26px\]">Job not available<\/h1>/);
});

test("the owned-jobs API accepts every status exposed by the job model", () => {
  const schemas = read("features/jobs/schemas.ts");
  const route = read("app/api/jobs/mine/route.ts");

  assert.match(schemas, /"DRAFT", "ACTIVE", "RESERVED", "EXPIRED", "FILLED", "CLOSED", "SUSPENDED"/);
  assert.match(route, /status: \{ values: jobStatuses \}/);
});
