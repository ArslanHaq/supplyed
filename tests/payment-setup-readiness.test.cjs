const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exports_ = {};
new Function('exports', ts.transpileModule(fs.readFileSync('features/payments/setup-readiness.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(exports_);
const { paymentSetupState: state, isPaymentSetupError } = exports_;

test('school readiness uses a ready card, independently of automatic payment preference', () => {
  assert.equal(state('institution', { canEnableAutomaticPayments: true, automaticPaymentsEnabled: false }, false), 'ready');
  assert.equal(state('institution', { canEnableAutomaticPayments: false, automaticPaymentsEnabled: true }, false), 'required');
  assert.equal(state('institution', { setupStatus: 'READY' }, false), 'required');
  assert.equal(state('institution', { canEnableAutomaticPayments: true, setupStatus: 'PENDING' }, false), 'ready');
});

test('teacher account existence alone never enables applications', () => {
  assert.equal(state('teacher', { connected: true, ready: false }, false), 'required');
  assert.equal(state('teacher', { connected: true }, false), 'required');
  assert.equal(state('teacher', { ready: true }, false), 'ready');
  assert.equal(state('teacher', { ready: 'true' }, false), 'required');
});

test('unknown/error status fails closed, including failed refreshes with stale ready data', () => {
  for (const role of ['teacher', 'institution']) {
    assert.equal(state(role, undefined, false), 'checking');
    assert.equal(state(role, undefined, true), 'unavailable');
    assert.equal(state(role, { ready: true, canEnableAutomaticPayments: true }, true), 'unavailable');
  }
  assert.equal(state('admin', undefined, false), 'ready');
});

test('only exact payment codes trigger the setup prompt', () => {
  assert.equal(isPaymentSetupError({ code: 'SCHOOL_CARD_REQUIRED' }), true);
  assert.equal(isPaymentSetupError({ code: 'TEACHER_PAYOUT_SETUP_REQUIRED' }), true);
  for (const result of [null, {}, { status: 403 }, { code: 'SCHOOL_INACTIVE' }, { code: 'INSTRUCTOR_DOCUMENTS_NOT_VERIFIED' }]) {
    assert.equal(isPaymentSetupError(result), false);
  }
});
