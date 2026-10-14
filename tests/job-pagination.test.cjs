const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

// Exercise the production list and buttons while isolating unrelated applicant
// requests. Like the other component tests, this requires no DOM or network.
function loadModule(filename, mocks) {
  const file = path.resolve(root, filename);
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  }).outputText;
  vm.runInNewContext(source, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        throw new Error(`Unexpected application import: ${specifier}`);
      }
      return require(specifier);
    },
  }, { filename: file });
  return loadedModule.exports;
}

const Icon = () => React.createElement("svg", { "aria-hidden": true });
const { Btn } = loadModule("components/atoms/Button.tsx", {
  "@/lib/cn": loadModule("lib/cn.ts", {}),
  "./Icon": { Icon },
});
const { JobManagementList } = loadModule("components/organisms/JobManagementList.tsx", {
  "../atoms": { Btn, Icon, Tag: ({ children }) => React.createElement("span", null, children) },
  "../molecules": { SectionLoader: () => React.createElement("div", { role: "status" }, "Loading") },
  "@/features/applications/use-applications": {
    useJobApplications: () => ({ data: { pagination: { total: 0 } }, isError: false }),
  },
});

function fixture({ page = 1, total = 13, limit = 6, ...overrides } = {}) {
  const offset = (page - 1) * limit;
  const jobs = Array.from({ length: Math.min(limit, Math.max(0, total - offset)) }, (_, index) => ({
    id: `job-${offset + index + 1}`, title: `Teaching role ${offset + index + 1}`,
    city: "Manchester", date: "12 Oct 2026", postedAt: "Today", rate: 180,
    requiredSkills: [], status: "ACTIVE", mode: "instant", urgent: false,
  }));
  const calls = [];
  const noop = () => {};
  const props = {
    title: "Job posts", emptyMessage: "Create a role to start matching.", filter: "ALL", jobs,
    pagination: { page, total, limit, totalPages: Math.ceil(total / limit), hasNextPage: offset + limit < total },
    onApplications: noop, onClose: noop, onCreate: noop, onDelete: noop, onEdit: noop, onFilterChange: noop,
    onPageChange: (nextPage) => calls.push(nextPage), ...overrides,
  };
  const html = renderToStaticMarkup(React.createElement(JobManagementList, props));
  const nav = html.match(/<nav\b[^>]*aria-label="Job pages"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  const controls = nav ? Array.from(nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g), ([, attributes, body]) => ({
    attributes, label: body.replace(/<[^>]+>/g, "").trim(), disabled: /\bdisabled(?:=|\s|$)/.test(attributes),
  })) : [];
  return { calls, controls, html, nav, props, text: html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ") };
}

function control(result, label) {
  const found = result.controls.find((item) => item.label === label);
  assert.ok(found, `Expected a ${label} pagination control`);
  return found;
}

for (const [page, summary, previousDisabled, nextDisabled] of [
  [1, "Showing 1–6 of 13 roles", true, false],
  [2, "Showing 7–12 of 13 roles", false, false],
  [3, "Showing 13–13 of 13 roles", false, true],
]) {
  test(`13 roles with a six-role limit: page ${page} reports its range and navigation boundaries`, () => {
    const result = fixture({ page });
    assert.match(result.text, new RegExp(summary));
    assert.equal(control(result, "Previous").disabled, previousDisabled);
    assert.equal(control(result, "Next").disabled, nextDisabled);
    assert.deepEqual(result.controls.filter((item) => /^\d+$/.test(item.label)).map((item) => item.label), ["1", "2", "3"]);
    assert.match(control(result, String(page)).attributes, /aria-current="page"/);
    assert.equal(result.controls.filter((item) => /aria-current="page"/.test(item.attributes)).length, 1);
    assert.doesNotMatch(result.nav, /…/);
  });
}

test("a single page retains its result summary and disables both boundary controls", () => {
  const result = fixture({ total: 4 });
  assert.match(result.text, /Showing 1–4 of 4 roles/);
  assert.equal(control(result, "Previous").disabled, true);
  assert.equal(control(result, "Next").disabled, true);
  assert.match(control(result, "1").attributes, /aria-current="page"/);
});

test("an empty result has no invalid numeric range and no next or previous page", () => {
  const result = fixture({ total: 0 });
  assert.match(result.text, /No roles found/);
  assert.match(result.text, /No roles to show/);
  assert.doesNotMatch(result.text, /Showing \d/);
  assert.equal(control(result, "Previous").disabled, true);
  assert.equal(control(result, "Next").disabled, true);
  assert.doesNotMatch(result.nav, /aria-label="Page 0"/);
});

test("long result sets show current neighbours and both endpoints with accessible ellipses", () => {
  const result = fixture({ page: 10, total: 120 });
  assert.match(result.text, /Showing 55–60 of 120 roles/);
  assert.deepEqual(result.controls.filter((item) => /^\d+$/.test(item.label)).map((item) => item.label), ["1", "9", "10", "11", "20"]);
  assert.equal((result.nav.match(/<span\b[^>]*aria-hidden="true"[^>]*>…<\/span>/g) ?? []).length, 2);
  assert.match(control(result, "10").attributes, /aria-current="page"/);
});

for (const pendingState of ["loading", "refreshing"]) {
  test(`${pendingState} announces progress and disables every page navigation control`, () => {
    const result = fixture({ page: 2, [pendingState]: true });
    assert.match(result.text, /Loading roles…/);
    assert.doesNotMatch(result.text, /Showing \d/);
    assert.match(result.html, /aria-busy="true"/);
    assert.ok(result.controls.length > 0);
    assert.ok(result.controls.every((item) => item.disabled));
    if (pendingState === "refreshing") assert.match(result.text, /Teaching role 7/);
  });
}

test("pagination is omitted when its data or navigation callback is unavailable", () => {
  assert.equal(fixture({ pagination: undefined }).nav, undefined);
  assert.equal(fixture({ onPageChange: undefined }).nav, undefined);
});

test("previous, next and numbered controls send the requested page to the existing callback", () => {
  const result = fixture({ page: 2 });
  const elements = [];
  function visit(node) {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      elements.push(child);
      visit(child.props.children);
    });
  }
  // Inspect the production element tree to exercise callback wiring. This is
  // deliberately not a browser click or client-state integration test.
  visit(JobManagementList(result.props));
  const previous = elements.find((element) => element.type === Btn && element.props.children === "Previous");
  const next = elements.find((element) => element.type === Btn && element.props.children === "Next");
  const pageThree = elements.find((element) => element.props["aria-label"] === "Page 3");
  for (const element of [previous, next, pageThree]) {
    assert.ok(element);
    assert.ok(!element.props.disabled);
    element.props.onClick();
  }
  assert.deepEqual(result.calls, [1, 3, 3]);
});
