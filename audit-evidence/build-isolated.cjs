const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const repo=process.argv[2];
if(!['web','admin'].includes(repo))throw new Error('Expected web or admin');
const root=path.resolve(__dirname,'..');
const source=repo==='web'?root:path.resolve(root,'../supplyed-admin');
const dest=path.join(__dirname,'build-'+repo);
fs.mkdirSync(dest,{recursive:true});
for(const name of ['app','components','features','hooks','lib','data','types','public','auth.ts','proxy.ts','next.config.mjs','next.config.ts','tsconfig.json','next-env.d.ts','package.json','package-lock.json','pnpm-lock.yaml','postcss.config.mjs','tailwind.config.ts']){
  const from=path.join(source,name);if(fs.existsSync(from))fs.cpSync(from,path.join(dest,name),{recursive:true});
}
if(!fs.existsSync(path.join(dest,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(dest,'node_modules'),'junction');
const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',API_BASE_URL:'http://127.0.0.1:9/api',AUTH_SECRET:randomBytes(48).toString('hex'),AUTH_URL:'http://127.0.0.1:4317'};
for(const key of Object.keys(env))if(/^(AWS_|S3_|STRIPE_|TWILIO_|SMTP_|GOOGLE_|AUTH_GOOGLE|AUTH_MICROSOFT|DATABASE_URL|TEST_DATABASE_URL|NEXT_PUBLIC_)/.test(key))delete env[key];
const log=fs.openSync(path.join(__dirname,repo+'-build.txt'),'w');
const start=Date.now();
const child=spawn(process.execPath,[path.join(source,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:dest,env,stdio:['ignore',log,log],windowsHide:true});
child.on('exit',(code)=>{fs.closeSync(log);const result={repo,code,seconds:(Date.now()-start)/1000,command:'next build --webpack',isolated:true,backend:'closed loopback port',envFilesCopied:false};fs.writeFileSync(path.join(__dirname,repo+'-build-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=code||0;});
