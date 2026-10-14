const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(filename, mocks = {}, cache = new Map()) {
  const file = path.resolve(root, filename);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file, module); cache.set(file, mod);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file }).outputText;
  mod.require = function (name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) return load(`${name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)}.ts`, mocks, cache);
    return require(name);
  };
  mod._compile(code, file);
  return mod.exports;
}
const validators = load('features/contact/validation.ts');
const codes = load('lib/auth-code-validation.ts');
const settings = load('features/settings/validation.ts');
const data = entries => { const form = new FormData(); for (const [key, value] of Object.entries(entries)) form.set(key, value); return form; };
const teacher = () => data({ type: 'TEACHER', firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.test', role: 'Qualified teacher (QTS)', area: 'Elsewhere in the United Kingdom', currentSupply: "No, but I'd like to start", daysPerWeek: '1 to 2', emailConsent: 'on' });

test('waitlist required fields and enum tampering are rejected before invoking the server action', async () => {
  let calls = 0;
  const client = load('features/contact/waitlist-client.ts', { './actions': { foundingInterestAction: async () => { calls++; return { ok: true, data: { id: 'local' } }; } } });
  for (const [field, value] of [['firstName', '  '], ['email', 'bad-email'], ['role', 'administrator'], ['area', 'Paris'], ['daysPerWeek', '100'], ['emailConsent', '']]) {
    const form = teacher(); form.set(field, value);
    const result = await client.submitWaitlistAction(null, form);
    assert.equal(result.ok, false); assert.ok(result.fieldErrors[field]);
    assert.equal(form.get('lastName'), 'Taylor', 'validation preserves valid input');
  }
  assert.equal(calls, 0);
  assert.equal((await client.submitWaitlistAction(null, teacher())).ok, true);
  assert.equal(calls, 1, 'corrected valid details progress exactly once');
});

test('optional waitlist phone accepts UK mobiles and landlines and rejects foreign and invalid prefilled data', () => {
  for (const phone of ['', '07400 123456', '020 7946 0018', '+44 (20) 7946-0018', '0044 7400 123456']) {
    const form = teacher(); form.set('phone', phone); assert.equal(validators.validateWaitlist(form).phone, undefined, phone);
  }
  for (const phone of ['+1 202 555 0123', '+33 1 42 68 53 00', '123', 'hello 07700900123']) {
    const form = teacher(); form.set('phone', phone); assert.ok(validators.validateWaitlist(form).phone, phone); assert.equal(form.get('phone'), phone);
  }
});

test('optional teacher details require a full UK postcode when supplied and preserve all four nations', () => {
  for (const postcode of ['', 'sw1a1aa', 'EH1 1YZ', 'CF10 1EP', 'BT1 5GS']) assert.equal(validators.validateWaitlistDetails(data({ postcode })).postcode, undefined, postcode);
  for (const postcode of ['M20', '90210', 'D02 X285', 'ABCDE']) assert.ok(validators.validateWaitlistDetails(data({ postcode })).postcode, postcode);
  assert.ok(validators.validateWaitlistDetails(data({ phases: 'unknown' })).phases);
  assert.ok(validators.validateWaitlistDetails(data({ mainSubject: 'x'.repeat(101) })).mainSubject);
});

test('single-input authenticator and OTP validators reject malformed and truncated input', () => {
  for (const value of ['', '12345', '1234567', 'abc123456', '12 34 56']) assert.equal(codes.validateOtpCode(value), false, value);
  assert.equal(codes.validateOtpCode(' 123456 '), true);
  assert.equal(codes.validateTwoFactorCode('abcd-efgh-jkmn-pqrs'), true);
  for (const value of ['', 'abcdef', 'ABCD-EFGH-IJKL-MNOP', '123456junk']) assert.equal(codes.validateTwoFactorCode(value), false, value);
});

test('settings resubmission rejects foreign saved values without altering personal information', () => {
  const valid = { role: 'teacher', user: { name: 'Alex Taylor', phone: '' }, instructor: { id: 'teacher', fullName: 'Alex Taylor', countryCode: 'GB', city: '', county: '', postalCode: '', address: '', currency: 'GBP', subjects: [], keyStages: [], skills: [] } };
  assert.equal(Object.keys(settings.validateSettingsInput(valid)).length, 0, 'optional fields remain optional');
  for (const [field, value] of [['countryCode', 'US'], ['city', 'Paris'], ['county', 'California'], ['postalCode', '90210']]) {
    const input = { ...valid, instructor: { ...valid.instructor, [field]: value } };
    assert.ok(settings.validateSettingsInput(input)[field]); assert.equal(input.instructor[field], value);
  }
  assert.ok(settings.validateSettingsInput({ ...valid, user: { ...valid.user, phone: '+1 202 555 0123' } }).phone);
  for (const city of ['London', 'Edinburgh', 'Cardiff', 'Belfast']) assert.equal(Object.keys(settings.validateSettingsInput({ ...valid, instructor: { ...valid.instructor, city } })).length, 0);
});

test('phone mutation hooks validate before SMS requests and normalize accepted UK numbers', async () => {
  const requests = [];
  const hooks = load('features/auth/use-phone-verification.ts', {
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({}), useIsMutating: () => 0 },
    'next-auth/react': { signOut: async () => {} },
    'next/navigation': { useRouter: () => ({ replace: () => {} }) },
    './phone-actions': { sendPhoneOtpAction: async value => { requests.push(value); return { ok: true, data: {} }; }, verifyPhoneOtpAction: async value => { requests.push(value); return { ok: true, data: {} }; } },
  });
  const send = hooks.useSendPhoneOtp().mutationFn, verify = hooks.useVerifyPhoneOtp().mutationFn;
  for (const phone of ['', '+1 202 555 0123', '+33 1 42 68 53 00', '123']) assert.equal((await send({ phone })).ok, false);
  for (const otp of ['', '12345', 'abc123456', '1234567']) assert.equal((await verify({ otp })).ok, false);
  assert.equal(requests.length, 0);
  await send({ phone: '020 7946 0018' });
  await send({ phone: '07400 123456' });
  await verify({ otp: ' 123456 ' });
  assert.deepEqual(requests, [{ phone: '+442079460018' }, { phone: '+447400123456' }, { otp: '123456' }]);
});

test('saved founding signup details preserve invalid personal values for correction instead of stripping them into valid numbers', () => {
  const previousWindow = global.window;
  const storage = new Map();
  global.window = { sessionStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key), removeItem: key => storage.delete(key) } };
  try {
    const intent = load('lib/founding-signup-intent.ts');
    assert.equal(intent.readFoundingSignupEmail('a'.repeat(250) + '@example.test'), undefined);
    intent.saveFoundingSignupIntent({ type: 'teacher', email: 'alex@example.test', dailyRate: '-100', yearsExperience: 'invalid-12', phone: '+1 202 555 0123', postcode: '90210' });
    const saved = intent.readFoundingSignupIntent('teacher');
    assert.equal(saved.dailyRate, '-100'); assert.equal(saved.yearsExperience, 'invalid-12');
    assert.equal(saved.phone, '+1 202 555 0123'); assert.equal(saved.postcode, '90210');
  } finally { global.window = previousWindow; }
});
