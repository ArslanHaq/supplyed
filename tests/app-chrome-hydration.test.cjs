const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { renderToString } = require("react-dom/server");
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

// Render the production component and query hooks, isolating account-menu UI
// and server actions. No network requests or real credentials are needed.
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
    module: loadedModule,
    exports: loadedModule.exports,
    require: (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.resolve(root, specifier.slice(2))
          : path.resolve(path.dirname(file), specifier);
        return loadModule(`${target}.ts`, mocks, cache);
      }
      return require(specifier);
    },
  }, { filename: file });
  return loadedModule.exports;
}

function fixture(role, mounted = false) {
  const mocks = {
    "../atoms": { Icon: () => React.createElement("svg"), Logo: () => React.createElement("span", null, "SupplyED") },
    "../molecules": { AppAccountMenu: () => React.createElement("span", null, "Account") },
    "./NotificationBell": { NotificationBell: () => React.createElement("span", null, "Notifications") },
    "./actions": {},
    ...(mounted ? { "@/lib/use-mounted": { useMounted: () => true } } : {}),
  };
  const cache = new Map();
  const { AppChrome } = loadModule("components/organisms/AppChrome.tsx", mocks, cache);
  const { useUnreadMessages } = loadModule("features/conversations/use-conversations.ts", mocks, cache);
  const { queryKeys } = loadModule("lib/query/keys.ts", mocks, cache);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const unreadKey = queryKeys.conversations.unread();
  const render = (child) => renderToString(React.createElement(QueryClientProvider, { client }, child));
  const props = { verified: false, state: { role, page: "bookings" }, go: () => {},
    onLanding: () => {}, onLogout: () => {}, onSettings: () => {} };
  function UnreadProbe() {
    return React.createElement("output", null, useUnreadMessages().data?.total ?? "empty");
  }
  return {
    client,
    setUnread: (total) => client.setQueryData(unreadKey, { total }),
    renderChrome: () => render(React.createElement(AppChrome, props, "Bookings")),
    renderProbe: () => render(React.createElement(UnreadProbe)),
  };
}

for (const role of ["teacher", "institution"]) {
  test(`${role} SSR markup stays identical when the unread cache is already populated`, () => {
    const { client, setUnread, renderChrome, renderProbe } = fixture(role);
    try {
      const emptyHtml = renderChrome();
      assert.doesNotMatch(emptyHtml, /notif-dot|aria-label="\d+ unread"/);
      for (const total of [1, 99, 105, 0]) {
        setUnread(total);
        assert.equal(renderProbe(), `<output>${total}</output>`, "the real query hook must expose the populated cache");
        assert.equal(renderChrome(), emptyHtml, "cached unread data must not change server markup");
      }
    } finally {
      client.clear();
    }
  });

  // Node has no DOM renderer installed. This checks display behavior after the
  // mounted boundary, while the SSR tests above exercise the real boundary hook.
  test(`${role} mounted unread indicators follow cache updates and cap the displayed count`, () => {
    const { client, setUnread, renderChrome } = fixture(role, true);
    try {
      for (const total of [0, 1, 99, 105, 0]) {
        setUnread(total);
        const html = renderChrome();
        if (total === 0) {
          assert.doesNotMatch(html, /aria-label="\d+ unread"/);
        } else {
          assert.match(html, new RegExp(`aria-label="${total} unread"`));
          const displayedCount = total > 99 ? "99\\+" : String(total);
          assert.match(html, new RegExp(`aria-label="${total} unread"[^>]*>${displayedCount}</span>`));
        }
      }
    } finally {
      client.clear();
    }
  });
}

test("admin does not display unread indicators from another role's cached count after mount", () => {
  const { client, setUnread, renderChrome } = fixture("admin", true);
  try {
    setUnread(105);
    assert.doesNotMatch(renderChrome(), /notif-dot|aria-label="\d+ unread"/);
  } finally {
    client.clear();
  }
});
