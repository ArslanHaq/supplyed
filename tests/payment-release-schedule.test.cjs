const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path) {
 const out=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const e={};new Function('exports','require',out)(e,()=>load('features/jobs/job-schedule.ts'));return e;
}
const {paymentReleaseSchedule:preview}=load('features/bookings/payment-release-schedule.ts');
const base={startDate:'2026-11-17',endDate:'2026-11-18',payType:'daily',paymentFrequency:'daily',schedule:{weekdays:[1,2,3,4,5].map(day=>({day,slots:[{start:'09:00',end:'15:00'}]}))}};
test('daily preview covers Tuesday and Wednesday and closes at next local midnight',()=>{
 const rows=preview(base);assert.deepEqual(rows.map(r=>r.releaseDate),['2026-11-18','2026-11-19']);assert.equal(rows[0].releaseTime,'00:00');
});
test('weekly assignment and calendar anchors produce different dates',()=>{
 assert.equal(preview({...base,paymentFrequency:'weekly',periodAnchor:'ASSIGNMENT_START'})[0].releaseDate,'2026-11-24');
 assert.equal(preview({...base,paymentFrequency:'weekly',periodAnchor:'CALENDAR'})[0].releaseDate,'2026-11-23');
});
test('month anniversaries clamp February and recover original day in March',()=>{
 const rows=preview({...base,startDate:'2028-01-31',endDate:'2028-03-01',paymentFrequency:'monthly'});
 assert.deepEqual(rows.map(r=>r.releaseDate),['2028-02-29','2028-03-31']);
});
test('fixed completion uses final overnight end and exceptions remove working dates',()=>{
 const b={...base,payType:'fixed',schedule:{weekdays:[{day:2,slots:[{start:'22:00',end:'06:00'}]},{day:3,slots:[{start:'09:00',end:'15:00'}]}],exceptions:[{date:'2026-11-18',kind:'exclude'}]}};
 const row=preview(b)[0];assert.equal(row.releaseDate,'2026-11-18');assert.equal(row.releaseTime,'06:00');assert.deepEqual(row.dates,['2026-11-17']);
});
test('preview is immutable and missing or milestone schedules do not invent dates',()=>{
 const before=JSON.stringify(base);preview(base);assert.equal(JSON.stringify(base),before);
 assert.deepEqual(preview({...base,schedule:null}),[]);assert.deepEqual(preview({...base,paymentFrequency:'milestone'}),[]);
});
const {isReleasePeriodPaid}=load('features/bookings/payment-release-schedule.ts');
test('completed status comes from confirmed period payments, including older invoices',()=>{
 const [first,second]=preview(base);
 const booking={invoice:{status:'OPEN',billingPeriodKey:second.key},attendancePayroll:{periods:[{key:first.key,paid:true},{key:second.key,paid:false}]}};
 assert.equal(isReleasePeriodPaid(booking,first),true);
 assert.equal(isReleasePeriodPaid(booking,second),false);
 assert.equal(isReleasePeriodPaid({invoice:null,attendancePayroll:null},first),false);
});
test('paid invoice only completes its matching period or an entire-booking payment',()=>{
 const [first,second]=preview(base);
 assert.equal(isReleasePeriodPaid({invoice:{status:'PAID',billingPeriodKey:first.key}},first),true);
 assert.equal(isReleasePeriodPaid({invoice:{status:'PAID',billingPeriodKey:first.key}},second),false);
 assert.equal(isReleasePeriodPaid({invoice:{status:'PAID',billingPeriodKey:null}},second),true);
 assert.equal(isReleasePeriodPaid({invoice:{status:'PENDING',billingPeriodKey:first.key}},first),false);
});
test('weekly and monthly keys match backend invoice period keys',()=>{
 assert.equal(preview({...base,paymentFrequency:'weekly',periodAnchor:'ASSIGNMENT_START'})[0].key,'week:1');
 assert.equal(preview({...base,paymentFrequency:'weekly',periodAnchor:'CALENDAR'})[0].key,'week:2026-11-16');
 assert.equal(preview({...base,paymentFrequency:'monthly',periodAnchor:'ASSIGNMENT_START'})[0].key,'month:1');
 assert.equal(preview({...base,paymentFrequency:'monthly',periodAnchor:'CALENDAR'})[0].key,'month:2026-11');
});
