const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(filename) {
  const file = path.resolve(root, filename);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} }; cache.set(file, loadedModule);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const resolve = (id) => id.startsWith('@/') || id.startsWith('.') ? load(`${id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id)}.ts`) : require(id);
  new Function('module', 'exports', 'require', 'FormData', 'File', code)(loadedModule, loadedModule.exports, resolve, FormData, File);
  return loadedModule.exports;
}
const { validateOnboardingStep } = load('components/organisms/onboarding/validation.ts');
const { initialForm } = load('components/organisms/onboarding/constants.ts');
const { buildOnboardingPayload, createInitialForm } = load('components/organisms/onboarding/utils.ts');
function validForm(extra = {}) {
  return { ...initialForm, fullName: 'Alex Teacher', phone: '020 7946 0123', profileCountryCode: 'GB', profileCity: 'London', postcode: 'sw1a1aa', subjects: ['Maths'], keyStages: ['KS2'], yearsExperience: '0', bio: 'Experienced teacher supporting pupils through clear lessons and thoughtful feedback.', schoolName: 'Example School', contactRole: 'Headteacher', institutionDomain: 'example.org.uk', institutionAddress: '1 School Lane', institutionCity: 'Cardiff', coverTypes: ['Same-day cover'], complianceContact: 'Sam Safeguarding', complianceEmail: 'sam@example.org.uk', safeguardingConfirmed: true, ...extra };
}
test('teacher, school and MAT valid paths accept UK data across every data step', () => {
  assert.equal(Object.keys(validateOnboardingStep(validForm(), 'teacher', 1)).length, 0);
  for (const type of ['SINGLE_SCHOOL', 'MAT_SCHOOL']) {
    const form = validForm({ institutionType: type, trustName: 'Example Trust', signatoryName: 'Sam Approver', signatoryEmail: 'trust@example.org.uk', signatoryJobTitle: 'Director' });
    for (const step of [1, 2, 3]) assert.equal(Object.keys(validateOnboardingStep(form, 'institution', step)).length, 0);
  }
});
test('teacher cannot advance with foreign or malformed phone/postcode/country/city', () => {
  const form = validForm({ phone: '+12025550123', postcode: '90210', profileCountryCode: 'US', profileCity: 'Toronto' });
  const before = JSON.stringify(form);
  const errors = validateOnboardingStep(form, 'teacher', 1);
  for (const field of ['phone', 'postcode', 'profileCountryCode', 'profileCity']) assert.ok(errors[field], field);
  assert.equal(JSON.stringify(form), before, 'validation must preserve user input');
});
test('school location is validated in its own step, including optional region and count', () => {
  const form = validForm({ institutionCountryCode: 'CA', institutionCity: 'Toronto', postcode: 'M5V 2T6', localAuthority: 'Ontario', typicalPupilCount: '1.5' });
  assert.equal(Object.keys(validateOnboardingStep(form, 'institution', 1)).length, 0);
  const errors = validateOnboardingStep(form, 'institution', 2);
  for (const field of ['institutionCountryCode', 'institutionCity', 'postcode', 'localAuthority', 'typicalPupilCount']) assert.ok(errors[field], field);
});
test('zero is valid, malformed numerical strings and missing selections are blocked', () => {
  const errors = validateOnboardingStep(validForm({ yearsExperience: 'NaN', dailyRate: '1..2', hourlyRate: 'Infinity', maxTravelDistance: '-1', subjects: [], keyStages: [] }), 'teacher', 1);
  for (const field of ['yearsExperience', 'dailyRate', 'hourlyRate', 'maxTravelDistance', 'subjects', 'keyStages']) assert.ok(errors[field], field);
});
test('MAT compliance and self-signatory validation remains enforced', () => {
  const errors = validateOnboardingStep(validForm({ institutionType: 'MAT_SCHOOL', email: 'same@example.org', signatoryEmail: ' SAME@example.org ', signatoryName: '', signatoryJobTitle: '', safeguardingConfirmed: false }), 'institution', 3);
  for (const field of ['signatoryEmail', 'signatoryName', 'signatoryJobTitle', 'safeguardingConfirmed']) assert.ok(errors[field], field);
});
test('payloads normalize accepted UK fields but preserve rejected data for server validation', () => {
  const payload = buildOnboardingPayload(validForm({ profileCity: ' london ', profileCountryCode: 'uk', teacherProfileId: 'existing-id', documents: { proof: { id: 'doc-id' } } }), 'teacher', 1);
  assert.equal(payload.get('phone'), '+442079460123');
  assert.equal(payload.get('postcode'), 'SW1A 1AA');
  assert.equal(payload.get('profileCountryCode'), 'GB');
  assert.equal(payload.get('profileCity'), 'London');
  assert.equal(payload.get('teacherProfileId'), 'existing-id');
  const rejected = buildOnboardingPayload(validForm({ phone: '+12025550123', profileCountryCode: 'US', profileCity: 'Toronto', postcode: '90210' }), 'teacher', 1);
  assert.equal(rejected.get('profileCountryCode'), 'US');
  assert.equal(rejected.get('profileCity'), 'Toronto');
  assert.equal(rejected.get('postcode'), '90210');
});
test('existing foreign profile data remains visible for explicit correction', () => {
  const form = createInitialForm('alex@example.org', { user: { phone: '+12025550123' }, instructor: { id: 'existing-id', countryCode: 'US', city: 'Boston', postalCode: '90210' } });
  assert.equal(form.profileCountryCode, 'US'); assert.equal(form.profileCity, 'Boston');
  assert.equal(form.postcode, '90210'); assert.equal(form.teacherProfileId, 'existing-id');
  assert.ok(validateOnboardingStep(form, 'teacher', 1).phone);
});
