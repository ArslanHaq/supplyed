const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadModule(filename, mocks, cache = new Map()) {
  const file = path.resolve(root, filename);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  }).outputText;
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports,
    require: (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.resolve(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
        const resolved = [`${target}.ts`, `${target}.tsx`].find((candidate) => fs.existsSync(candidate));
        if (!resolved) throw new Error(`Unexpected import ${specifier}`);
        return loadModule(resolved, mocks, cache);
      }
      return require(specifier);
    },
  }, { filename: file });
  return loadedModule.exports;
}

const Icon = () => React.createElement("svg", { "aria-hidden": true });
const { Btn } = loadModule("components/atoms/Button.tsx", { "./Icon": { Icon } });
const { PageHead } = loadModule("components/molecules/PageHead.tsx", {});
const baseJob = {
  id: "job-one", title: "Year 6 cover", city: "Manchester", county: "Greater Manchester", date: "12 Oct 2026",
  school: "Oak School", rate: 180, payType: "daily", requiredSkills: [], subject: "Primary", status: "ACTIVE",
};
const application = {
  id: "application-one", jobId: "job-one", instructorId: "teacher-one", status: "VIEWED",
  instructor: { id: "teacher-one", fullName: "Alex Teacher", subjects: ["Primary"], keyStages: ["KS2"], skills: [], ratingCount: 0 },
};

function fixture({ ctx = {}, page = 1, total = 2, fetching = false, error = null, empty = false, selectedStatus = "ACTIVE" } = {}) {
  const navigation = [];
  const pageChanges = [];
  const buttons = [];
  const queries = { jobs: [], job: [], applications: [], ranked: [] };
  const count = empty ? 0 : Math.min(6, Math.max(0, total - (page - 1) * 6));
  const jobs = Array.from({ length: count }, (_, index) => ({ ...baseJob,
    id: index === 0 ? "job-one" : `job-${index + 1}`,
    title: index === 0 ? "Year 6 cover" : `Science cover ${index + 1}`,
    status: "ACTIVE",
  }));
  const query = (data) => ({ data, isLoading: false, isFetching: false, error: null });
  const mocks = {
    "../atoms": {
      Btn: (props) => { buttons.push(props); return React.createElement(Btn, props); }, Icon,
      Tag: ({ children }) => React.createElement("span", null, children),
      Avatar: ({ name }) => React.createElement("span", null, name),
    },
    "../molecules": {
      PageHead, SectionLoader: () => React.createElement("div", { role: "status" }, "Loading"),
      Modal: ({ open, children }) => open ? React.createElement("div", null, children) : null,
      ProposalContent: () => null, MatchScorePanel: () => null,
    },
    "../molecules/BookingPaymentNotice": { BookingPaymentNotice: () => null },
    "../molecules/ProposalPreviewModal": { ProposalPreview: () => null },
    "@/features/jobs/use-jobs": {
      useMyJobs: (filters) => {
        queries.jobs.push(JSON.parse(JSON.stringify(filters)));
        return { ...query({ jobs, pagination: { page, limit: 6, total: empty ? 0 : total, totalPages: Math.ceil(total / 6), hasNextPage: page * 6 < total } }),
          error, isFetching: fetching, refetch: () => {} };
      },
      useJob: (id, ownerView) => { queries.job.push({ id, ownerView }); return query(id ? { ...baseJob, status: selectedStatus } : undefined); },
      useUpdateJob: () => ({ isPending: false, mutate: () => assert.fail("Navigation must not update a job") }),
    },
    "@/features/applications/use-applications": {
      useJobApplications: (id) => { queries.applications.push(id); return query(id ? { applications: [application], pagination: { total: 1 } } : undefined); },
      useUpdateApplicationStatus: () => ({ isPending: false, mutate: () => assert.fail("These navigation checks must not change application status") }),
    },
    "@/features/matching/use-matching": {
      useRankedApplications: (id) => { queries.ranked.push(id); return query(undefined); },
    },
    "@/features/reviews/use-reviews": { useInstructorReviews: () => query({ reviews: [], pagination: { total: 0 } }) },
  };
  const { ApplicationsPage } = loadModule("components/organisms/ApplicationsWorkspacePage.tsx", mocks);
  const { ApplicationsJobList } = loadModule("components/organisms/ApplicationsJobList.tsx", mocks);
  const render = (component = ApplicationsPage) => renderToStaticMarkup(React.createElement(component, component === ApplicationsPage
    ? { ctx, go: (destination, context) => navigation.push({ destination, context }), toast: () => {} }
    : { page, onPageChange: (next) => pageChanges.push(next), onOpenJob: () => {} }));
  return { render, ApplicationsJobList, navigation, pageChanges, buttons, queries };
}

function button(fixture, label) {
  const found = fixture.buttons.find((props) => props.children === label || props["aria-label"] === label);
  assert.ok(found, `Expected button: ${label}`);
  return found;
}

test("Applications requests active jobs only and opens the chosen job's applications", () => {
  const view = fixture();
  const html = view.render();
  assert.match(html, /Year 6 cover/);
  assert.match(html, /Science cover 2/);
  assert.match(html, /ACTIVE/);
  assert.match(html, /Active jobs/);
  assert.doesNotMatch(html, /Alex Teacher/);
  assert.deepEqual(view.queries.jobs, [{ limit: 6, page: 1, status: "ACTIVE" }]);
  assert.deepEqual(view.queries.job, [{ id: "", ownerView: true }]);
  assert.deepEqual(view.queries.applications, [undefined]);
  assert.deepEqual(view.queries.ranked, [undefined]);
  button(view, "View applications for Science cover 2").onClick();
  assert.equal(view.navigation[0].destination, "applications");
  assert.deepEqual(JSON.parse(JSON.stringify(view.navigation[0].context)), { jobId: "job-2" });
});

test("a closed job direct link still opens its applications and can return to active jobs", () => {
  const view = fixture({ ctx: { jobId: "job-one" }, selectedStatus: "CLOSED" });
  const html = view.render();
  assert.match(html, /Alex Teacher/);
  assert.equal(view.queries.jobs.length, 0, "A direct job link must not wait for the jobs list");
  assert.deepEqual(view.queries.applications, ["job-one"]);
  button(view, "Open application").onClick();
  button(view, "Back to active jobs").onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(view.navigation)), [
    { destination: "applications", context: { applicationId: "application-one", jobId: "job-one" } },
    { destination: "applications" },
  ]);
});

test("an application deep link opens the detail and its back button keeps the selected job", () => {
  const view = fixture({ ctx: { jobId: "job-one", applicationId: "application-one" } });
  const html = view.render();
  assert.match(html, /Application progress/);
  assert.doesNotMatch(html, /Open application/);
  assert.equal(view.queries.jobs.length, 0);
  button(view, "Back to applications").onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(view.navigation)), [{ destination: "applications", context: { jobId: "job-one" } }]);
});

test("an unknown application deep link retains its unavailable message and selected job", () => {
  const view = fixture({ ctx: { jobId: "job-one", applicationId: "missing" } });
  assert.match(view.render(), /Application not found/);
  assert.deepEqual(view.queries.applications, ["job-one"]);
  assert.equal(view.queries.jobs.length, 0);
});

test("active jobs are reachable through paginated results with correct ranges and boundaries", () => {
  for (const [page, start, end] of [[1, 1, 6], [2, 7, 12], [3, 13, 13]]) {
    const view = fixture({ page, total: 13 });
    const html = view.render(view.ApplicationsJobList);
    assert.match(html, new RegExp(`Showing ${start}–${end} of 13 jobs`));
    assert.deepEqual(view.queries.jobs, [{ limit: 6, page, status: "ACTIVE" }]);
    const previous = button(view, "Previous");
    const next = button(view, "Next");
    assert.equal(previous.disabled, page === 1);
    assert.equal(next.disabled, page === 3);
    if (!previous.disabled) previous.onClick();
    if (!next.disabled) next.onClick();
    assert.deepEqual(view.pageChanges, [page > 1 ? page - 1 : null, page < 3 ? page + 1 : null].filter(Boolean));
  }
});

test("refreshing jobs keeps the rows visible and disables pagination until the response arrives", () => {
  const view = fixture({ page: 2, total: 13, fetching: true });
  const html = view.render(view.ApplicationsJobList);
  assert.match(html, /Year 6 cover/);
  assert.match(html, /Loading jobs/);
  assert.match(html, /aria-busy="true"/);
  assert.equal(button(view, "Previous").disabled, true);
  assert.equal(button(view, "Next").disabled, true);
});

test("empty and failed job requests show guidance without opening an application automatically", () => {
  const empty = fixture({ empty: true });
  assert.match(empty.render(), /No active jobs yet/);
  assert.equal(empty.buttons.some((props) => props.children === "View applications"), false);
  const failed = fixture({ error: new Error("Could not load jobs") });
  assert.match(failed.render(), /Jobs unavailable/);
  button(failed, "Try again");
  assert.equal(failed.navigation.length, 0);
});
