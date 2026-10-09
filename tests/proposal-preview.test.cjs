const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const atoms = {
  Avatar: ({ name }) => React.createElement("span", { "aria-label": `${name} profile` }),
  Icon: () => React.createElement("svg", { "aria-hidden": true }),
  Btn: ({ children, onClick, ...props }) => React.createElement("button", { "aria-haspopup": props["aria-haspopup"], onClick }, children),
};

function loadModule(filename, cache = new Map()) {
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
      if (specifier === "../atoms") return atoms;
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.resolve(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
        const resolved = [`${target}.ts`, `${target}.tsx`].find((candidate) => fs.existsSync(candidate));
        if (!resolved) throw new Error(`Unexpected import ${specifier}`);
        return loadModule(resolved, cache);
      }
      return require(specifier);
    },
  }, { filename: file });
  return loadedModule.exports;
}

const { ProposalPreview, ProposalPreviewModal } = loadModule("components/molecules/ProposalPreviewModal.tsx");
const details = {
  applicantName: "Alex Teacher", jobTitle: "Year 6 cover", schoolName: "Oak School",
  submittedAt: "2026-10-09T10:00:00Z",
  value: `<p>My classroom experience.</p>${"<p>Additional teaching experience and approach.</p>".repeat(30)}<p>Final proposal paragraph &amp; availability.</p>`,
};

test("the compact preview offers a full-proposal dialog without opening it initially", () => {
  const markup = renderToStaticMarkup(React.createElement(ProposalPreview, details));
  assert.match(markup, /aria-haspopup="dialog"/);
  assert.match(markup, /View full proposal/);
  assert.match(markup, /line-clamp-3/);
  assert.doesNotMatch(markup, /role="dialog"/);
});

test("the full reader retains the final paragraph and application context inside a labelled dialog", () => {
  // This runs the real Modal and ProposalContent server-render path. Browser
  // sanitisation and focus/scroll behaviour are checked separately in visual QA.
  const markup = renderToStaticMarkup(React.createElement(ProposalPreviewModal, { ...details, open: true, onClose: () => {} }));
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-label="Proposal from Alex Teacher"/);
  assert.match(markup, /Year 6 cover/);
  assert.match(markup, /Oak School/);
  assert.match(markup, /Final proposal paragraph &amp; availability\./);
  assert.doesNotMatch(markup, /line-clamp/);
  assert.match(markup, /aria-label="Full proposal text"[^>]*role="region"[^>]*tabindex="0"/);
});

test("both full-reader close controls call the supplied close handler", () => {
  let closed = 0;
  const controls = [];
  function visit(node) {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.props["aria-label"] === "Close full proposal" || child.type === atoms.Btn) controls.push(child);
      visit(child.props.children);
    });
  }
  visit(ProposalPreviewModal({ ...details, open: true, onClose: () => { closed += 1; } }));
  assert.equal(controls.length, 2);
  for (const control of controls) control.props.onClick();
  assert.equal(closed, 2);
});
