const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('features/jobs/job-schedule.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = {};
new Function('exports', compiled)(api);
const slot = { start: '09:00', end: '15:00' };
const initial = { weekdays: [1,2,3,4,5].map(day => ({ day, slots: [{...slot}] })), exceptions: [] };

test('Tuesday–Wednesday only allows those weekdays and generates two shifts', () => {
  assert.deepEqual(api.weekdaysInDateRange('2026-11-17','2026-11-18'), [2,3]);
  const schedule = api.scheduleForDateChange(initial,'2026-11-17','2026-11-18','','');
  assert.deepEqual(schedule.weekdays.map(item => item.day), [2,3]);
  assert.deepEqual(api.scheduleIntervals(schedule,'2026-11-17','2026-11-18').map(item => item.date), ['2026-11-17','2026-11-18']);
  assert.match(api.validateStructuredSchedule(initial,'2026-11-17','2026-11-18'), /only weekdays/);
});
test('longer range repeats Monday–Friday including next Monday, excluding weekend', () => {
  const short = api.scheduleForDateChange(initial,'2026-11-17','2026-11-18','','');
  const schedule = api.scheduleForDateChange(short,'2026-11-16','2026-11-23','2026-11-17','2026-11-18');
  assert.deepEqual(schedule.weekdays.map(item => item.day), [1,2,3,4,5]);
  const shifts = api.scheduleIntervals(schedule,'2026-11-16','2026-11-23');
  assert.deepEqual(shifts.map(item => item.date), ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-23']);
  assert.equal(shifts.reduce((sum,item) => sum + item.minutes,0),2160);
});
test('preserves custom hours and deselected weekdays when extending an existing full week', () => {
  const custom = {weekdays: [{day:2,slots:[{start:'10:00',end:'14:00'}]}]};
  const next=api.scheduleForDateChange(custom,'2026-11-16','2026-11-30','2026-11-16','2026-11-23');
  assert.deepEqual(next.weekdays,custom.weekdays);
});
test('invalid/incomplete dates do not erase selections; single-day and month-crossing ranges work', () => {
  assert.equal(api.weekdaysInDateRange('2026-02-30','2026-03-02'),null);
  assert.equal(api.scheduleForDateChange(initial,'2026-11-18','','',''),initial);
  assert.deepEqual(api.weekdaysInDateRange('2026-11-18','2026-11-18'),[3]);
  assert.deepEqual(api.weekdaysInDateRange('2026-11-30','2026-12-01'),[1,2]);
});

test('fixed pay only permits after-completion payments; recurring rate options remain available', () => {
  assert.deepEqual(api.allowedPaymentFrequencies('fixed'), ['completion']);
  assert.deepEqual(api.allowedPaymentFrequencies('daily'), ['daily','weekly','monthly']);
  assert.deepEqual(api.allowedPaymentFrequencies('hourly'), ['daily','weekly','monthly']);
});
