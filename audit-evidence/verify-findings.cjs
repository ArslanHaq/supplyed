// Isolated audit probes. All persistence, storage and provider calls are mocked.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {randomBytes, randomUUID} = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('../node_modules/typescript');
const web = path.resolve(__dirname,'..');
const backend = path.resolve(web,'../supplyed-backend');
const admin = path.resolve(web,'../supplyed-admin');
const cache = new Map();
function load(file, root, stubs = {}) {
  file = path.resolve(file);
  if (cache.has(file) && !Object.keys(stubs).length) return cache.get(file);
  const source = fs.readFileSync(file,'utf8');
  const compiled = ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};
  const native=createRequire(file);
  function req(name) {
    if (name in stubs) return stubs[name];
    if(name==='server-only') return {};
    if(name.startsWith('.')||name.startsWith('@/')) {
      const resolved=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
      const candidate=[resolved,resolved+'.ts',resolved+'.tsx',path.join(resolved,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
      if(candidate&&/\.tsx?$/.test(candidate)) return load(candidate,root,stubs);
    }
    return native(name);
  }
  vm.runInThisContext('(function(require,module,exports,__filename,__dirname){'+compiled+'\n})',{filename:file})(req,mod,mod.exports,file,path.dirname(file));
  if (!Object.keys(stubs).length) cache.set(file,mod.exports);
  return mod.exports;
}
const results=[];
async function probe(id,fn) {
  try {results.push({id,status:'REPRODUCED',evidence:await fn()});}
  catch(error){results.push({id,status:'PROBE_FAILED',error:error.message});process.exitCode=1;}
}
(async()=>{
  process.env.JWT_REFRESH_SECRET=randomBytes(48).toString('hex');
  process.env.JWT_OTP_SECRET=randomBytes(48).toString('hex');
  const backendRequire=createRequire(path.join(backend,'package.json'));
  const bcrypt=backendRequire('bcrypt');
  const {JwtService}=backendRequire('@nestjs/jwt');
  const jwt=new JwtService({secret:randomBytes(48).toString('hex'),signOptions:{expiresIn:'15m'}});
  const {AuthService}=load(path.join(backend,'src/modules/auth/auth.service.ts'),backend);
  const user={id:randomUUID(),email:'fixture@example.test',role:'ADMIN',emailVerified:true,password:await bcrypt.hash('OldFixturePassword!1',4)};
  let writes=0;
  let consumed=false;
  const users={findByEmailWithPassword:async()=>({...user}),findByEmail:async()=>({...user}),findById:async()=>({...user}),getById:async()=>({...user}),recordLogin:async()=>({...user}),updatePassword:async(id,p)=>{writes++;user.password=p;return {...user};}};
  const otpHash=await bcrypt.hash('123456',4);
  const otps={create:async()=>({}),findLatestActiveByUserId:async()=>consumed?null:{id:'otp-fixture',codeHash:otpHash,attempts:0},consumeAllForUser:async()=>{consumed=true;},incrementAttempts:async()=>({attempts:1})};
  const auth=new AuthService(users,jwt,{},otps,{sendPasswordResetOtp:async()=>{}},{},{isEnabled:async()=>false});
  await probe('AUTH-REVOCATION',async()=>{
    const original=await auth.login({email:user.email,password:'OldFixturePassword!1'});
    await auth.resetPassword(user.id,'123456','NewFixturePassword!2');
    const a=await auth.refresh(original.refreshToken);
    const b=await auth.refresh(original.refreshToken);
    assert.equal(a.user.id,user.id);assert.equal(b.user.id,user.id);
    return 'One pre-reset refresh token succeeded twice after the password changed; real JWT verification and bcrypt, mocked user/OTP persistence.';
  });
  await probe('OTP-CONCURRENCY',async()=>{
    consumed=false;const before=writes;
    const both=await Promise.allSettled([auth.resetPassword(user.id,'123456','RaceFixturePassword!3'),auth.resetPassword(user.id,'123456','RaceFixturePassword!4')]);
    assert.equal(both.filter(r=>r.status==='fulfilled').length,2);assert.equal(writes-before,2);
    return 'Two concurrent calls using one reset OTP both succeeded and each wrote a different password; no database used.';
  });
  await probe('RESET-ENUMERATION',async()=>{
    const existing=await auth.forgotPassword(user.email);
    users.findByEmail=async()=>null;
    const absent=await auth.forgotPassword('absent@example.test');
    assert.equal(jwt.decode(existing.otpToken).role,'ADMIN');assert.equal(jwt.decode(absent.otpToken).role,'INSTRUCTOR');
    return 'Public forgot-password token discloses ADMIN for an existing fixture account and INSTRUCTOR for an absent fixture account.';
  });
  await probe('BFF-RATE-BUDGET',async()=>{
    const {RateLimitGuard}=load(path.join(backend,'src/common/guards/rate-limit.guard.ts'),backend);
    const buckets=new Map();const prisma={$queryRaw:async(strings,key)=>{const n=(buckets.get(key)||0)+1;buckets.set(key,n);return [{count:n,retryAfter:900}];}};
    const guard=new RateLimitGuard(prisma,{get:(key,object)=>object==='controller'?'auth':'register'});
    let allowed=0,denied=0;
    for(let i=0;i<6;i++){
      const context={getClass:()=> 'controller',getHandler:()=> 'handler',switchToHttp:()=>({getRequest:()=>({ip:'127.0.0.1',headers:{},method:'POST',body:{email:`fixture${i}@example.test`}}),getResponse:()=>({setHeader:()=>{}})})};
      try{await guard.canActivate(context);allowed++;}catch(e){assert.equal(e.getStatus(),429);denied++;}
    }
    assert.equal(allowed,5);assert.equal(denied,1);
    return 'Six distinct emails sharing the BFF source IP: five accepted by guard, sixth rejected for 900 seconds; counter mocked.';
  });
  await probe('PAYOUT-KEY-COLLISION',async()=>{
    const {InstantPayoutsService}=load(path.join(backend,'src/modules/payments/instant-payouts.service.ts'),backend);
    const {isPayoutReady}=load(path.join(backend,'src/modules/payments/payout-accounts.service.ts'),backend);
    const account={stripeAccountId:'acct_fixture',instructorId:'fixture',chargesEnabled:true,payoutsEnabled:true,detailsSubmitted:true,transfersCapability:'active',cardPaymentsCapability:'active',requirementsCurrentlyDue:[],requirementsPastDue:[],disabledReason:null};
    const keys=[];const service=new InstantPayoutsService({findByInstructorId:async()=>account},{findByUserId:async()=>({id:'fixture'})},{call:async(action,fn)=>fn({payouts:{create:async(params,options)=>{keys.push(options.idempotencyKey);return {id:'po_fixture',amount:params.amount,arrival_date:0};}}})});
    if(!isPayoutReady(account)) throw new Error('Fixture payout readiness does not match current model');
    service.readBalance=async()=>({instantAvailablePence:1000,instantDestination:{id:'bank_fixture'}});
    await service.withdraw({id:'fixture'},500);await service.withdraw({id:'fixture'},500);
    assert.equal(keys[0],keys[1]);
    return 'Two separate withdrawal intents at a recurring balance produced the same Stripe idempotency key.';
  });
  await probe('SOCKET-UNBOUNDED-MAPS',async()=>{
    const {ConversationsGateway}=load(path.join(backend,'src/modules/conversations/conversations.gateway.ts'),backend);
    let lookups=0;
    const gateway=new ConversationsGateway({}, {}, {}, {markRead:async()=>{lookups++;}},{});
    const client={data:{user:{id:'fixture'},readAt:new Map(),typing:new Map()}};
    for(let i=0;i<50;i++)await gateway.onRead(client,{conversationId:randomUUID()});
    assert.equal(client.data.readAt.size,50);assert.equal(lookups,50);
    return 'Fifty bounded events with different UUIDs created fifty retained map entries and fifty service lookups; no sockets/network used.';
  });
  await probe('ADMIN-2FA',async()=>{
    const originalFetch=global.fetch;
    process.env.API_BASE_URL='http://127.0.0.1:9/api';
    global.fetch=async()=>Response.json({success:true,message:'fixture',data:{twoFactorRequired:true,twoFactorToken:'fixture'}});
    try {
      const {authenticateAdmin}=load(path.join(admin,'lib/auth/authenticate.ts'),admin);
      const result=await authenticateAdmin({email:'admin@example.test',password:'FixturePassword!1'});
      assert.deepEqual(result,{ok:false,code:'two_factor_required'});
      return 'A valid two-factor challenge is returned as terminal login failure; only email/password credentials are accepted by the admin provider.';
    } finally{global.fetch=originalFetch;}
  });
  await probe('PAYOUT-ORIGIN',async()=>{
    let forwarded=false;
    const {POST}=load(path.join(web,'app/api/payments/payout-account/instant-payout/route.ts'),web,{'@/lib/server/api-client':{api:{post:async()=>{forwarded=true;return {id:'fixture',amountPence:40,status:'pending',method:'instant',arrivalDate:'2026-10-28'};}}}});
    const response=await POST(new Request('http://app.example.test/api/payments/payout-account/instant-payout',{method:'POST',headers:{Origin:'http://other.example.test','Content-Type':'text/plain'},body:'{"amountPence":40,"ignored":"="}'}));
    assert.equal(forwarded,true);assert.equal(response.status,201);
    return 'A sibling-origin text/plain request reached the mocked payout API and returned 201; real-browser cookie delivery remains untested.';
  });
  await probe('PASSWORD-72-BYTES',async()=>{
    const prefix='Aa1!'.repeat(18);
    const hash=await bcrypt.hash(prefix+'first',4);
    assert.equal(await bcrypt.compare(prefix+'second',hash),true);
    const {validatePassword}=load(path.join(web,'features/auth/schemas.ts'),web);
    assert.equal(validatePassword(prefix+'first'),true);
    return 'Two web-valid passwords with the same first 72 bytes and different suffixes compare equal under installed bcrypt.';
  });
  await probe('WAITLIST-DUPLICATE',async()=>{
    const {ContactService}=load(path.join(backend,'src/modules/contact/contact.service.ts'),backend);
    let creates=0;
    const service=new ContactService({}, {findFoundingInterestByEmailAndType:async()=>null,createFoundingInterest:async()=>({id:String(++creates)})},{});
    await Promise.all([service.saveFoundingInterestOnce({email:'fixture@example.test',type:'TEACHER'}),service.saveFoundingInterestOnce({email:'fixture@example.test',type:'TEACHER'})]);
    assert.equal(creates,2);
    return 'Two concurrent duplicate checks both created a waitlist row; persistence mocked. Schema has no email/type unique constraint.';
  });
  await probe('ADMIN-USER-ROLE-CONTRACT',async()=>{
    const {validate}=backendRequire('class-validator');
    const {plainToInstance}=backendRequire('class-transformer');
    const {AdminCreateUserDto}=load(path.join(backend,'src/modules/users/dto/admin-create-user.dto.ts'),backend);
    let forwarded;
    const {POST}=load(path.join(admin,'app/api/users/route.ts'),admin,{'next/cache':{revalidatePath:()=>{}},'@/lib/api/admin-api-client':{adminApiRequest:async(opts)=>{forwarded=opts.body;return {ok:false,status:400,message:'role must be a valid signup role'};}}});
    const request=new Request('http://admin.example.test/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'fixture@example.test',password:'FixturePassword!1',role:'INSTRUCTOR'})});
    const response=await POST(request);
    assert.equal(forwarded.role,undefined);
    const errors=await validate(plainToInstance(AdminCreateUserDto,forwarded));
    assert.ok(errors.some(e=>e.property==='role'));
    assert.equal(response.status,400);
    return 'Admin BFF strips a supplied role; actual backend DTO validation rejects the forwarded body for missing role. No account created.';
  });
  fs.writeFileSync(path.join(__dirname,'verified-findings.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
})();
