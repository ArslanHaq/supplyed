const assert = require("node:assert/strict");
const test = require("node:test");

test("API responses have an explicit private no-store policy", async () => {
  const { default: nextConfig } = await import("../next.config.mjs");
  const rules = await nextConfig.headers();
  const apiRule = rules.find((rule) => rule.source === "/api/:path*");

  assert.ok(apiRule, "Expected one cache policy covering every API route");

  const headers = Object.fromEntries(
    apiRule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );

  assert.equal(headers["cache-control"], "private, no-store, max-age=0, must-revalidate");
  assert.equal(headers.pragma, "no-cache");
  assert.equal(headers.expires, "0");
});
