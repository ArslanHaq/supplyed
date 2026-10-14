const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(actions) {
  const testModule = { exports: {} };
  const file = path.resolve(__dirname, '../features/contact/waitlist-client.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: () => actions });
  return testModule.exports;
}

test('an outdated action or network rejection returns an inline failure instead of crashing the page', async () => {
  for (const error of [new Error('Server Action was not found on the server'), new TypeError('Failed to fetch')]) {
    const { submitWaitlistAction } = load({ foundingInterestAction: async () => { throw error; } });
    const result = await submitWaitlistAction(null, new FormData());
    assert.equal(result.ok, false);
    assert.match(result.message, /refresh this page/);
  }
});

test('successful and invalid submissions preserve the original action result', async () => {
  for (const result of [{ ok: true, data: { submitted: true, id: 'saved', detailsToken: 'token' } }, { ok: false, message: 'Check the highlighted fields', fieldErrors: { email: 'Invalid email' } }]) {
    const form = new FormData();
    const { submitWaitlistAction } = load({ foundingInterestAction: async (previous, received) => { assert.equal(received, form); return result; } });
    assert.equal(await submitWaitlistAction(null, form), result);
  }
});

test('failed optional detail requests keep the saved waitlist confirmation', async () => {
  const { submitWaitlistDetailsAction } = load({ saveWaitlistDetailsAction: async () => { throw new TypeError('Failed to fetch'); } });
  const result = await submitWaitlistDetailsAction(null, new FormData());
  assert.equal(result.ok, false);
  assert.match(result.message, /place is already saved/);
});
