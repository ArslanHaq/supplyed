const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const out=ts.transpileModule(fs.readFileSync('features/payments/payment-status.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const e={};new Function('exports','require',out)(e,require);
const {canPayBookingManually:can}=e;
const ready={covered:true,pendingAmountPence:0,reviewAmountPence:0,payableAmountPence:4000};
const base={role:'institution',bookingStatus:'COMPLETED',automaticState:'DISABLED',schoolAutomaticPaymentsEnabled:false,invoice:null,payroll:ready};
const paid={status:'PAID',automatic:true,failed:false};
test('school that switched automation off can invoice a completed booking',()=>{assert.equal(can(base),true);});
test('after a paid automatic period the remaining work can still be invoiced',()=>{assert.equal(can({...base,invoice:paid}),true);});
test('a cancelled automatic payment or older booking (review required) can be invoiced',()=>{
 assert.equal(can({...base,automaticState:'REVIEW_REQUIRED',schoolAutomaticPaymentsEnabled:true,invoice:paid}),true);
});
test('no manual path while automation is on, fully paid, unfinished attendance, or for teachers',()=>{
 assert.equal(can({...base,schoolAutomaticPaymentsEnabled:true}),false);
 assert.equal(can({...base,automaticState:'PAID',invoice:paid}),false);
 assert.equal(can({...base,payroll:{...ready,pendingAmountPence:500}}),false);
 assert.equal(can({...base,bookingStatus:'CONFIRMED'}),false);
 assert.equal(can({...base,role:'teacher'}),false);
});
test('an open manual invoice is paid directly; a scheduled automatic one is not',()=>{
 assert.equal(can({...base,invoice:{status:'OPEN',automatic:false,failed:false}}),true);
 assert.equal(can({...base,invoice:{status:'OPEN',automatic:true,failed:false}}),false);
 assert.equal(can({...base,invoice:{status:'OPEN',automatic:true,failed:true}}),true);
});
