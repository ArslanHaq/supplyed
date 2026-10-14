const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = ts.transpileModule(fs.readFileSync(path.join(root, "features/payments/stripe-client.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load(browser = {}) {
  const loadedModule = { exports: {} };
  let stripeLoads = 0;
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, ...browser,
    require: (name) => {
      assert.equal(name, "@stripe/stripe-js");
      return { loadStripe: () => { stripeLoads += 1; return Promise.resolve({}); } };
    },
  });
  return { ...loadedModule.exports, stripeLoads: () => stripeLoads };
}

test("Stripe server appearance uses the site's canonical form tokens", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const token = (name) => css.match(new RegExp(`${name}:\\s*([^;]+);`))[1].trim();
  const stripe = load();
  const variables = stripe.getPaymentAppearance().variables;
  for (const [property, name] of Object.entries({ colorPrimary: "--se-dark", colorBackground: "--surface", colorText: "--ink", colorTextSecondary: "--muted", colorDanger: "--red", borderRadius: "--control-radius" })) {
    assert.equal(variables[property], token(name), property);
  }
});

test("active theme changes update appearance once without loading a new Stripe session", async () => {
  const tokens = { "--se-dark": "#006e9a" };
  let notify, observed, disconnected = false;
  const element = {};
  class Observer {
    constructor(callback) { notify = callback; }
    observe(target, options) { observed = { target, options }; }
    disconnect() { disconnected = true; }
  }
  const stripe = load({ document: { documentElement: element }, MutationObserver: Observer, window: { getComputedStyle: () => ({ getPropertyValue: (name) => tokens[name] || "" }) } });
  const original = stripe.getStripe("pk_fixture");
  await original;
  const updates = [];
  const stop = stripe.observeStripeTheme(() => updates.push(stripe.getConnectAppearance()));
  notify();
  assert.equal(updates.length, 0, "unrelated style changes must not update frames");
  tokens["--se-dark"] = "#6b219c";
  notify();
  notify();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].variables.colorPrimary, "#6b219c");
  assert.equal(stripe.getPaymentAppearance().variables.colorPrimary, "#6b219c");
  assert.equal(stripe.getStripe("pk_fixture"), original);
  assert.equal(stripe.stripeLoads(), 1);
  assert.equal(observed.target, element);
  assert.deepEqual(Array.from(observed.options.attributeFilter), ["style", "class"]);
  stop();
  assert.equal(disconnected, true);
});
