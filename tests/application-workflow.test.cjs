const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../features/applications/workflow.ts");
const loadedModule = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
vm.runInNewContext(source, { module: loadedModule, exports: loadedModule.exports }, { filename });
const { canTransitionApplication } = loadedModule.exports;

// These explicit product rules cover all 36 source/target pairs, including
// skipped stages, attempts to move backwards, and both terminal states.
const allowedTargets = {
  APPLIED: ["VIEWED", "SHORTLISTED", "INTERVIEW", "HIRED", "REJECTED"],
  VIEWED: ["SHORTLISTED", "INTERVIEW", "HIRED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "HIRED", "REJECTED"],
  INTERVIEW: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
};

for (const [current, targets] of Object.entries(allowedTargets)) {
  test(`${current} permits only its allowed forward transitions or rejection`, () => {
    for (const target of Object.keys(allowedTargets)) {
      assert.equal(canTransitionApplication(current, target), targets.includes(target), `${current} -> ${target}`);
    }
  });
}
