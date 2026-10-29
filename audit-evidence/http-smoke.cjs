const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const routes=JSON.parse(fs.readFileSync(path.join(__dirname,'route-inventory.json'),'utf8'));
const rows=[];
(async()=>{
  const pages=routes.filter(r=>r.repo==='web'&&r.type==='page');
  const publicPages=new Set(['/','/terms','/how-it-works','/founding-schools','/founding-teachers','/login','/signup','/forgot-password']);
  for(const p of pages){
    const route=p.route.replace('[token]','audit-fixture-invalid');
    const started=performance.now();
    try{
      const res=await fetch('http://127.0.0.1:4317'+route,{redirect:'manual',signal:AbortSignal.timeout(15000)});
      const html=await res.text();
      const expected=publicPages.has(route)?200:route.startsWith('/signatory-approval/')?200:307;
      const streamedLoginRedirect=res.status===200 && /NEXT_REDIRECT;replace;\/login|url=\/login|url=http:\/\/127\.0\.0\.1:4317\/login/i.test(html);
      rows.push({route,status:res.status,expected:expected===307?'307 or a streamed login redirect':expected,pass:res.status===expected || (expected===307&&streamedLoginRedirect),streamedLoginRedirect,location:res.headers.get('location'),milliseconds:Math.round(performance.now()-started),htmlBytes:Buffer.byteLength(html),securityHeaders:{csp:res.headers.get('content-security-policy'),frame:res.headers.get('x-frame-options'),nosniff:res.headers.get('x-content-type-options'),referrer:res.headers.get('referrer-policy')},renderedError:/Application error:|Internal Server Error/.test(html)});
    }catch(error){rows.push({route,error:error.name,pass:false});}
  }
  for(const route of ['/api/auth/session','/api/auth/me','/api/jobs/mine','/api/onboarding/me','/api/invoices/me','/api/conversations','/api/notifications','/api/payments/payout-account']){
    const res=await fetch('http://127.0.0.1:4317'+route,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    await res.text();
    const expected=route==='/api/auth/session'?200:401;
    rows.push({route,status:res.status,expected,pass:res.status===expected,cacheControl:res.headers.get('cache-control'),test:'Guest BFF against auth-denying mock backend; no protected data'});
  }
  fs.writeFileSync(path.join(__dirname,'http-smoke.json'),JSON.stringify(rows,null,2));
  console.log(JSON.stringify(rows,null,2));
})();
