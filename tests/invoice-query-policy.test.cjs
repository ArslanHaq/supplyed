const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "..", "features", "payments", "query-policy.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
vm.runInNewContext(compiled, { exports: policyModule.exports, module: policyModule, require });

const {
  activeInvoiceRefreshMs,
  invoiceRefreshInterval,
  settledInvoiceRefreshMs,
} = policyModule.exports;

test("active invoice states retain fast reconciliation", () => {
  for (const status of ["PENDING", "OPEN", "UNCOLLECTIBLE"]) {
    assert.equal(invoiceRefreshInterval([{ status }]), activeInvoiceRefreshMs);
  }
});

test("paid invoices reconcile slowly and void invoices stop polling", () => {
  assert.equal(invoiceRefreshInterval([{ status: "PAID" }]), settledInvoiceRefreshMs);
  assert.equal(invoiceRefreshInterval([{ status: "VOID" }]), false);
  assert.equal(invoiceRefreshInterval([]), false);
});

test("a mixed page follows the most urgent invoice state", () => {
  assert.equal(
    invoiceRefreshInterval([{ status: "PAID" }, { status: "OPEN" }]),
    activeInvoiceRefreshMs,
  );
});
