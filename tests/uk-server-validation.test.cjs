const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Run real modules and maintained validation dependencies in one JS realm.
// Every network/auth/write boundary is replaced; no external service is called.
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(__dirname, '..', file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loadedModule = { exports: {} };
    cache.set(absolute, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/') || id.startsWith('.')) {
        const target = id.startsWith('@/') ? path.resolve(__dirname, '..', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load([target, `${target}.ts`, path.join(target, 'index.ts')].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
      }
      return require(id);
    };
    new Function('require', 'module', 'exports', 'process', 'fetch', source)(localRequire, loadedModule, loadedModule.exports, { env: { NODE_ENV: 'test', API_BASE_URL: 'https://backend.example/api' } }, () => { throw new Error('Unexpected network call'); });
    return loadedModule.exports;
  }
  return load;
}
const uk = loader()('lib/uk-validation.ts');
const form = values => { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; };
const teacher = { role: 'teacher', step: '1', fullName: 'Teacher Example', phone: '07912 123456', email: 'teacher@example.com', profileCountryCode: 'GB', profileCity: 'London', postcode: 'sw1a1aa', subjects: '["Maths"]', keyStages: '["KS2"]', skills: '[]', yearsExperience: '3', bio: 'Experienced teacher supporting inclusive classroom learning every day.', currency: 'GBP' };
function fixture(extra = {}) {
  const calls = [];
  const api = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, async (url, body) => { calls.push({ method, url, body }); return {}; }]));
  const mocks = { 'next/cache': { revalidateTag() {} }, '@/lib/server/api-client': { api, ApiError: class extends Error {} }, '@/lib/server/auth-context': { getServerAuthContext: async () => ({ userId: 'user', accessToken: 'test', refreshToken: 'test' }) }, ...extra };
  return { calls, api, load: loader(mocks) };
}

test('UK phone validation accepts mobile, landline, national and international formats and normalizes E.164', () => {
  for (const value of ['07912123456', '07912 123456', '(07912) 123-456', '+44 7912 123456', '+44 (0)7912 123456', '+44-7912-123456', '0044 7912 123456', '0044 (0)7912 123456']) assert.equal(uk.validateUkPhone(value, { required: true }).value, '+447912123456', value);
  for (const value of ['020 7946 0000', '+44 (0)20 7946 0000', '028 9012 3456', '0131 496 0000', '029 2018 0000', '0300 123 4567', '0800 1111']) assert.equal(uk.validateUkPhone(value, { required: true }).valid, true, value);
});
test('creating teacher and institution profiles saves the submitted UK phone even when signup already assigned a role', async () => {
  for (const role of ['teacher', 'institution']) for (const initial of [{ phone: '', verified: false }, { phone: '+12025550123', verified: false }, { phone: '+923001234567', verified: false }, { phone: '+923001234567', verified: true }, { phone: '07912 123456', verified: true }]) {
    const savedPhone = initial.phone;
    const wasVerified = initial.verified;
    const user = { id: 'user', email: 'teacher@example.com', role: role === 'teacher' ? 'INSTRUCTOR' : 'INSTITUTION', phone: savedPhone, phoneVerified: wasVerified, emailVerified: true, name: 'Contact' };
    const normalizeRole = value => ['teacher', 'INSTRUCTOR'].includes(value) ? 'teacher' : ['institution', 'INSTITUTION'].includes(value) ? 'institution' : null;
    const f = fixture({
      '@/features/auth/backend': { normalizeRole, normalizeStatus: () => 'none', normalizeAuthUser: value => ({ ...value, role: normalizeRole(value.role) }) },
      '@/features/auth/session-ticket': { createVerifiedEmailSessionTicket: () => 'test-ticket' },
      '@/lib/server/token-refresh': { getValidAccessToken: async () => 'test-token' },
      '@/lib/server/jwt': { readUnverifiedJwtExpiresAt: () => undefined },
      './documents': { getProfileDocumentRequirements: async () => [{ id: 'proof', name: 'Proof', code: 'ID', context: 'INSTRUCTOR_PROFILE', isRequired: true, requiresReview: true, allowedMimes: ['application/pdf'], maxSizeBytes: 1000 }], getDocumentSnapshots: async () => ({}) },
    });
    f.api.get = async url => url === '/auth/me' || url === '/users/user' ? user : {};
    f.api.patch = async (url, body) => { f.calls.push({ method: 'patch', url, body }); if (url === '/users/me') Object.assign(user, Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined))); return user; };
    f.api.post = async (url, body) => { f.calls.push({ method: 'post', url, body }); if (url === '/auth/phone/otp/verify') { user.phone = '+447912123456'; user.phoneVerified = true; return user; } return { ...body, id: 'profile', status: 'DRAFT' }; };
    const school = { ...teacher, role: 'institution', schoolName: 'Local school', contactRole: 'Head teacher', institutionCountryCode: 'GB', institutionCity: 'London', institutionAddress: '1 School Road', institutionDomain: 'school.org.uk', institutionType: 'SINGLE_SCHOOL', coverTypes: '["Daily"]', complianceContact: 'Safeguarding Lead', complianceEmail: 'safeguarding@school.org.uk', safeguardingConfirmed: 'true' };
    const actions = f.load('features/onboarding/actions.ts');
    const input = form({ ...(role === 'teacher' ? teacher : school), phone: '0044 (0)7912 123456', intent: 'profile' });
    if (wasVerified && savedPhone.startsWith('+92')) {
      const blocked = await actions.submitOnboardingAction(input);
      assert.equal(blocked.ok, false); assert.match(blocked.message, /Verify your new phone/); assert.equal(f.calls.length, 0);
      const verified = await f.load('features/auth/phone-actions.ts').verifyPhoneOtpAction({ otp: '123456' });
      assert.equal(verified.ok, true); assert.equal(verified.data.phone, '+447912123456'); f.calls.length = 0;
    }
    const result = await actions.submitOnboardingAction(input);
    assert.equal(result.ok, true, `${role}/${savedPhone}: ${result.message}`);
    assert.equal(f.calls[0].url, '/users/me'); assert.equal(f.calls[0].body.phone, wasVerified ? undefined : '+447912123456');
    assert.equal(f.calls[1].url, role === 'teacher' ? '/instructors' : '/institutions');
    assert.equal(result.data.snapshot.user.phone, wasVerified && !savedPhone.startsWith('+92') ? savedPhone : '+447912123456'); assert.equal(result.data.snapshot.user.phoneVerified, wasVerified);
  }
});
test('UK phones reject foreign codes, crown dependencies, malformed, reserved and invalid prefilled values', () => {
  for (const value of ['+1 202 555 0123', '+92 300 1234567', '0092 300 1234567', '+33 1 42 68 53 00', '+447911123456', '+441624123456', '07700900123', '123', 'phone 02079460000', '02079460000 ext 1', {}, 2079460000]) assert.equal(uk.validateUkPhone(value, { required: true }).valid, false, String(value));
  assert.equal(uk.validateUkPhone('').valid, true);
  assert.equal(uk.validateUkPhone('', { required: true }).valid, false);
});
test('UK postcode validation covers every format and all four nations without claiming existence', () => {
  for (const value of ['M1 1AA', 'M60 1NW', 'W1A 1HQ', 'B33 8TH', 'CR2 6XH', 'DN55 1PT', 'SW1A 1AA', 'EC1A 1BB', 'GIR 0AA', 'BT1 5GS', 'CF10 1EP', 'EH1 1YZ']) assert.equal(uk.validateUkPostcode(value, { required: true }).valid, true, value);
  assert.equal(uk.validateUkPostcode('  sw1a1aa  ').value, 'SW1A 1AA');
  for (const value of ['M20', '90210', '75001', 'D02 X285', 'GY1 1AA', 'JE2 3QA', 'IM1 1AA', 'ZZ1 1ZZ', 'SW1A 1CI', '', {}]) assert.equal(uk.validateUkPostcode(value, { required: true }).valid, false, String(value));
  assert.equal(uk.validateUkPostcode('').valid, true);
});
test('country and maintained location selections include UK nations and reject foreign values', () => {
  for (const value of ['GB', 'gb', 'UK', 'United Kingdom']) assert.equal(uk.validateUkCountry(value, { required: true }).value, 'GB');
  for (const value of ['US', 'IE', 'FR', 'GG', '', {}]) assert.equal(uk.validateUkCountry(value, { required: true }).valid, false);
  for (const city of ['London', 'Cardiff', 'Edinburgh', 'Belfast', 'Derry']) assert.equal(uk.validateUkCity(city, { required: true }).valid, true, city);
  for (const region of ['England', 'Scotland', 'Wales', 'Northern Ireland', 'Greater Manchester']) assert.equal(uk.validateUkRegion(region).valid, true, region);
  for (const city of ['Paris', 'Toronto', 'New York', 'not a city']) assert.equal(uk.validateUkCity(city).valid, false);
  for (const region of ['California', 'Ascension Island', 'Saint Helena']) assert.equal(uk.validateUkRegion(region).valid, false);
  assert.ok(uk.getUkCities().length > 3800);
  assert.equal(uk.validateUkCity('  belfast ').value, 'Belfast');
});
test('onboarding direct step and final submissions reject invalid fields before auth or backend access', async () => {
  const f = fixture({ '@/features/auth/backend': {}, '@/features/auth/session-ticket': {}, '@/lib/server/token-refresh': {}, './documents': {} });
  const actions = f.load('features/onboarding/actions.ts');
  for (const change of [{ phone: '+12025550123' }, { postcode: '90210' }, { profileCountryCode: 'US' }, { profileCity: 'Paris' }, { yearsExperience: 'NaN' }, { yearsExperience: '-1' }, { subjects: '[]' }, { bio: 'short' }]) {
    for (const action of [actions.saveOnboardingStepAction, actions.submitOnboardingAction]) {
      const input = form({ ...teacher, ...change });
      const result = await action(input);
      assert.equal(result.ok, false);
      assert.ok(Object.keys(result.fieldErrors).length);
      assert.equal(input.get('fullName'), teacher.fullName);
    }
  }
  assert.equal(f.calls.length, 0);
});
test('onboarding school location waits for its own step and final validation cannot be bypassed with step=1', () => {
  const { validateOnboardingForm, normalizeOnboardingForm } = loader()('features/onboarding/validation.ts');
  const input = form({ role: 'institution', step: '1', fullName: 'School Contact', phone: '02079460000', institutionCountryCode: 'US', institutionCity: 'Boston' });
  assert.deepEqual(validateOnboardingForm(input), {});
  assert.ok(validateOnboardingForm(input, { complete: true }).institutionCountryCode);
  const normalized = normalizeOnboardingForm(form(teacher));
  assert.equal(normalized.get('phone'), '+447912123456'); assert.equal(normalized.get('postcode'), 'SW1A 1AA');
});
test('settings resubmission rejects malformed saved geo and optional numeric fields before any write', async () => {
  const f = fixture({ '@/features/auth/backend': {}, './queries': { getSettingsProfileSnapshot: async () => { throw new Error('Should not query'); } } });
  const update = f.load('features/settings/actions.ts').updateSettingsAction;
  const valid = { role: 'teacher', user: { name: 'Teacher', phone: '+447912123456' }, instructor: { fullName: 'Teacher', countryCode: 'GB', city: 'London', postalCode: 'SW1A 1AA', county: '', keyStages: [], skills: [], subjects: [] } };
  for (const change of [{ countryCode: 'US' }, { city: 'Paris' }, { postalCode: '90210' }, { dailyRate: 'Infinity' }, { county: 'California' }]) {
    const input = { ...valid, instructor: { ...valid.instructor, ...change } };
    const result = await update(input); assert.equal(result.ok, false); assert.ok(result.fieldErrors); assert.equal(input.instructor.fullName, 'Teacher');
  }
  assert.equal(f.calls.length, 0);
});
test('phone server action rejects direct bypasses, normalizes accepted input and distrusts foreign challenge responses', async () => {
  const f = fixture(); const actions = f.load('features/auth/phone-actions.ts');
  for (const phone of ['+12025550123', 'invalid', '', '+447911123456']) assert.equal((await actions.sendPhoneOtpAction({ phone })).ok, false);
  assert.equal(f.calls.length, 0);
  f.api.post = async (url, body) => { f.calls.push({ url, body }); return { phone: body.phone, expiresInMinutes: 10, resendAvailableInSeconds: 60 }; };
  assert.equal((await actions.sendPhoneOtpAction({ phone: '(020) 7946-0000' })).ok, true);
  assert.equal(f.calls[0].body.phone, '+442079460000');
  f.api.post = async () => ({ phone: '+12025550123', id: 'user', phoneVerified: true, expiresInMinutes: 10, resendAvailableInSeconds: 60 });
  assert.equal((await actions.sendPhoneOtpAction({ phone: '02079460000' })).ok, false);
  assert.equal((await actions.verifyPhoneOtpAction({ otp: '123456' })).ok, false);
});
test('job direct writes reject invalid UK data and malformed rates, dates, arrays and enum values', async () => {
  const f = fixture(); const actions = f.load('features/jobs/actions.ts');
  const valid = { title: 'Primary teacher', description: 'Teach a welcoming primary class with inclusive routines.', keyStages: [], countryCode: 'GB' };
  for (const change of [{ countryCode: 'US' }, { city: 'Paris' }, { postalCode: '90210' }, { county: 'California' }, { payAmount: -1 }, { minExperienceYears: NaN }, { startDate: '2099-02-30' }, { endDate: 'garbage' }, { keyStages: [42] }, { payType: 'weekly' }, { status: 'ACTIVE', description: 'short' }]) {
    assert.equal((await actions.createJobAction({ ...valid, ...change })).ok, false);
  }
  assert.equal(f.calls.length, 0);
  f.api.post = async (url, body) => { f.calls.push({ url, body }); return { ...body, id: 'job', status: 'DRAFT' }; };
  const result = await actions.createJobAction({ ...valid, city: ' belfast ', postalCode: 'bt15gs', countryCode: 'UK', payType: 'fixed' });
  assert.equal(result.ok, true); assert.equal(f.calls[0].body.countryCode, 'GB'); assert.equal(f.calls[0].body.city, 'Belfast'); assert.equal(f.calls[0].body.postalCode, 'BT1 5GS');
});
test('status-only publish cannot resubmit an invalid saved foreign job', async () => {
  const f = fixture(); f.api.get = async url => { assert.equal(url, '/jobs/mine/job'); return { id: 'job', title: 'Teacher', description: 'Teach a welcoming primary school class.', countryCode: 'US', city: 'Boston' }; };
  const result = await f.load('features/jobs/actions.ts').updateJobAction({ id: 'job', status: 'ACTIVE' });
  assert.equal(result.ok, false); assert.ok(result.fieldErrors.countryCode); assert.equal(f.calls.length, 0);
});
test('review, cancellation, message and preference tampering is rejected before mutation', async () => {
  const f = fixture(); const bookings = f.load('features/bookings/actions.ts');
  for (const rating of [0, 6, 1.5, NaN, '5']) assert.equal((await bookings.createBookingReviewAction({ bookingId: 'booking', rating })).ok, false);
  assert.equal((await bookings.updateBookingStatusAction({ id: 'booking', action: 'cancel', reason: ' ' })).ok, false);
  assert.equal((await bookings.updateBookingStatusAction({ id: 'booking', action: 'invalid' })).ok, false);
  const messages = f.load('features/conversations/actions.ts');
  for (const input of [{ conversationId: 'conversation', body: ' '.repeat(20) }, { conversationId: 'conversation', body: 'x'.repeat(2001) }, { conversationId: 'conversation', attachmentIds: 'invalid' }]) assert.equal((await messages.sendMessageAction(input)).ok, false);
  assert.equal((await f.load('features/notifications/actions.ts').updateNotificationPreferencesAction({ emailMessages: 'yes' })).ok, false);
  assert.equal(f.calls.length, 0);
});
test('settings cannot disguise a foreign saved phone with a valid submitted replacement', async () => {
  const f = fixture({ '@/features/auth/backend': {}, './queries': { getSettingsProfileSnapshot: async () => ({ user: { phone: '+12025550123' }, instructor: { id: 'profile' } }) } });
  const input = { role: 'teacher', user: { name: 'Teacher', phone: '+447912123456' }, instructor: { id: 'profile', fullName: 'Teacher', countryCode: 'GB', subjects: [], keyStages: [], skills: [] } };
  const result = await f.load('features/settings/actions.ts').updateSettingsAction(input);
  assert.equal(result.ok, false); assert.ok(result.fieldErrors.phone); assert.equal(f.calls.length, 0);
});
test('profile images reject empty files and explicitly unsupported MIME before storage requests', async () => {
  const f = fixture({ '@/features/auth/backend': {}, './queries': {} });
  const upload = f.load('features/settings/actions.ts').uploadSettingsProfileImageAction;
  for (const file of [new File([], 'photo.png', { type: 'image/png' }), new File(['text'], 'photo.png', { type: 'text/plain' })]) {
    const data = new FormData(); data.set('file', file); assert.equal((await upload(data)).ok, false);
  }
  assert.equal(f.calls.length, 0);
});
test('job display normalization does not convert an optional county or postcode into a structured city', () => {
  const { normalizeBackendJob } = loader()('features/jobs/schemas.ts');
  const result = normalizeBackendJob({ id: 'job', title: 'Teacher', description: 'Classroom cover.', county: 'Greater Manchester', postalCode: 'M1 1AA' });
  assert.equal(result.city, 'Location TBC');
});
test('direct search filters reject impossible dates, reversed ranges, enum and pagination tampering', async () => {
  const calls = [];
  const rejectQuery = async () => { calls.push('query'); return {}; };
  const load = loader({ '@/features/jobs/queries': { listJobs: rejectQuery }, '@/features/bookings/queries': { listMyBookings: rejectQuery }, '@/features/payments/queries': { listAllInvoices: rejectQuery } });
  for (const [route, query] of [
    ['app/api/jobs/route.ts', 'page=0'], ['app/api/jobs/route.ts', 'limit=101'], ['app/api/jobs/route.ts', 'status=INVALID'], ['app/api/jobs/route.ts', 'urgent=maybe'],
    ['app/api/bookings/me/route.ts', 'from=2099-02-30'], ['app/api/bookings/me/route.ts', 'from=2099-02-02&to=2099-01-01'], ['app/api/bookings/me/route.ts', 'jobId=not-a-uuid'], ['app/api/invoices/route.ts', 'page=-1'],
  ]) assert.equal((await load(route).GET(new Request(`https://app.example/api/list?${query}`))).status, 400, query);
  assert.equal(calls.length, 0);
});
test('credential authorization never strips or truncates OTP and signup requires accepted terms', async () => {
  let config;
  const calls = [];
  const response = { user: { id: 'user', email: 'teacher@example.com', emailVerified: true } };
  const backend = { verifyEmail: async input => { calls.push(input); return response; }, normalizeRole: () => 'teacher' };
  loader({ 'next-auth': { __esModule: true, default: value => { config = value; return { handlers: {} }; } }, 'next-auth/providers/credentials': { __esModule: true, default: value => value }, 'next-auth/providers/google': { __esModule: true, default: () => {} }, 'next-auth/providers/microsoft-entra-id': { __esModule: true, default: () => {} }, 'next/headers': {}, '@/features/auth/backend': backend, '@/features/auth/session-ticket': {} })('auth.ts');
  for (const code of ['12a3456', '1234567', '12345']) assert.equal(await config.providers[0].authorize({ email: 'teacher@example.com', flow: 'verify-email', code }), null);
  assert.equal(calls.length, 0);
  assert.equal((await config.providers[0].authorize({ email: 'teacher@example.com', flow: 'verify-email', code: '123456' })).id, 'user');
  assert.equal(calls[0].code, '123456');
  const f = fixture({ '@/auth': {}, '@/features/onboarding/documents': {}, './backend': {} });
  const result = await f.load('features/auth/actions.ts').signupWithEmailAction(null, form({ role: 'teacher', email: 'teacher@example.com', password: 'Password1!' }));
  assert.equal(result.ok, false); assert.ok(result.fieldErrors.termsAccepted); assert.equal(f.calls.length, 0);
});
test('direct payout JSON, signatory decisions and directory filters reject bypasses with HTTP 400', async () => {
  const f = fixture({ '@/features/teachers/queries': { listTeacherDirectory: async () => { throw new Error('Should not query'); } } });
  const payout = f.load('app/api/payments/payout-account/instant-payout/route.ts');
  for (const body of ['{', 'null', '[]', '{"amountPence":"100"}', '{"amountPence":-1}', '{"amountPence":0.4}']) assert.equal((await payout.POST(new Request('https://app.example/api/payout', { method: 'POST', body }))).status, 400);
  const approval = f.load('app/api/signatory-approvals/[token]/route.ts');
  for (const input of [{ action: 'approve', acceptTerms: false }, { action: 'decline', reason: '' }, { action: 'decline', reason: 'x'.repeat(1001) }, null]) assert.equal((await approval.POST(new Request('https://app.example/api/approval', { method: 'POST', headers: { Origin: 'https://app.example' }, body: JSON.stringify(input) }), { params: Promise.resolve({ token: 'local-test-token-123' }) })).status, 400);
  const directory = f.load('app/api/instructors/directory/route.ts');
  for (const query of ['city=Paris', 'minRating=6', 'minExperience=NaN', 'maxDailyRate=-1', 'page=0', 'availableToday=maybe']) assert.equal((await directory.GET(new Request(`https://app.example/api/directory?${query}`))).status, 400);
  assert.equal(f.calls.length, 0);
});
test('auth parsers preserve malformed OTPs for rejection and direct auth gateway validates credentials', async () => {
  const schemas = loader()('features/auth/schemas.ts');
  assert.equal(schemas.parsePasswordResetForm(form({ code: '1234567' })).code, '1234567');
  assert.equal(schemas.parseEmailVerificationForm(form({ code: '12a3456' })).code, '12a3456');
  const f = fixture(); const auth = f.load('features/auth/backend.ts');
  await assert.rejects(() => auth.loginWithEmail({ email: 'invalid', password: 'Password1!' }));
  await assert.rejects(() => auth.createEmailAccount({ email: 'teacher@example.com', role: 'admin', password: 'Password1!' }));
  await assert.rejects(() => auth.resetPassword({ code: '12a456', password: 'Password1!' }));
  await assert.rejects(() => auth.requestPasswordReset({ email: 'invalid' }));
  assert.equal(f.calls.length, 0);
});
