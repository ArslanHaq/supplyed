// Loopback-only audit runtime. No real credentials or upstream services.
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const stub=http.createServer((req,res)=>{
  const publicData=req.url.startsWith('/api/dropdowns')||req.url.startsWith('/api/teaching-catalogue');
  res.writeHead(publicData?503:401,{'Content-Type':'application/json'});
  res.end(JSON.stringify({success:false,message:publicData?'Audit fixture: catalogue unavailable':'Authentication required',code:publicData?'AUDIT_FIXTURE':'AUTH_TOKEN_MISSING'}));
});
stub.listen(4320,'127.0.0.1',()=>{
  const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',API_BASE_URL:'http://127.0.0.1:4320/api',AUTH_SECRET:randomBytes(48).toString('hex'),AUTH_URL:'http://127.0.0.1:4317',AUTH_TRUST_HOST:'true'};
  for(const key of Object.keys(env))if(/^(AWS_|S3_|STRIPE_|TWILIO_|SMTP_|GOOGLE_|AUTH_GOOGLE|AUTH_MICROSOFT|DATABASE_URL|TEST_DATABASE_URL|NEXT_PUBLIC_)/.test(key))delete env[key];
  const log=fs.openSync(path.join(__dirname,'local-runtime.txt'),'w');
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','4317'],{cwd:path.join(__dirname,'build-web'),env,stdio:['ignore',log,log],windowsHide:true});
  fs.writeFileSync(path.join(__dirname,'runtime-pids.json'),JSON.stringify({parent:process.pid,next:child.pid,ports:[4317,4320]}));
  console.log('Audit runtime started: loopback 4317; mock API loopback 4320.');
  child.on('exit',code=>{fs.closeSync(log);stub.close();process.exitCode=code||0;});
});
