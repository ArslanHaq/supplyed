const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const roots={web:root,backend:path.resolve(root,'../supplyed-backend'),admin:path.resolve(root,'../supplyed-admin')};
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,'source-inventory.json'),'utf8'));
const rules={htmlSink:/dangerouslySetInnerHTML|\.innerHTML\s*=/,dynamicExecution:/\beval\(|new Function\(|\bexecSync\(|\$queryRawUnsafe|\$executeRawUnsafe/,browserStorage:/localStorage|sessionStorage/,request:/\bfetch\(|\bapi\.(get|post|patch|delete|put)[<(]/,emptyHandler:/on(?:Click|Change)=\{\(\)\s*=>\s*\{\s*\}\}/,suppressedError:/catch\s*\{\s*\}|catch\(\(\)\s*=>\s*(?:undefined|null)/,unsafeTyping:/\bas any\b|\bas unknown as\b|@ts-ignore|@ts-nocheck/,databaseRaw:/\$queryRaw|\$executeRaw/,browserRedirect:/window\.open\(|location\.(href|assign|replace)/};
const hits=[];const secrets=[];const envSummary=[];
const secretRules={privateKey:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,stripeLive:/\bsk_live_[A-Za-z0-9]{16,}\b/,awsAccess:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,githubToken:/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,googleToken:/\bAIza[0-9A-Za-z_-]{30,}\b/,credentialAssignment:/(?:secret|password|api[_-]?key)\s*[:=]\s*['"][^'"]{16,}['"]/i};
for(const f of inventory){const source=fs.readFileSync(path.join(roots[f.repo],f.path),'utf8');source.split('\n').forEach((line,i)=>{for(const [rule,re]of Object.entries(rules))if(re.test(line))hits.push({repo:f.repo,path:f.path,line:i+1,rule});for(const [rule,re]of Object.entries(secretRules))if(re.test(line))secrets.push({repo:f.repo,path:f.path,line:i+1,rule,value:'REDACTED',testFixture:/spec\.ts$|test\./.test(f.path)});});}
for(const [repo,dir]of Object.entries(roots)){
 const tracked=execFileSync('git',['-c','safe.directory='+dir.replaceAll('\\','/'),'ls-files','--','.env','.env.*'],{cwd:dir,encoding:'utf8',windowsHide:true}).trim().split('\n').filter(Boolean);
 for(const name of fs.readdirSync(dir).filter(n=>n==='.env'||n.startsWith('.env.'))){const lines=fs.readFileSync(path.join(dir,name),'utf8').split('\n');envSummary.push({repo,file:name,tracked:tracked.includes(name),assignments:lines.filter(l=>/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(l)).length,values:'NOT INCLUDED; no credentials used'});}
}
const versions=Object.entries(roots).map(([repo,dir])=>({repo,packages:Object.fromEntries(Object.keys(JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).dependencies).map(name=>{try{return [name,JSON.parse(fs.readFileSync(path.join(dir,'node_modules',name,'package.json'),'utf8')).version]}catch{return[name,'not resolved']}}))}));
fs.writeFileSync(path.join(__dirname,'static-scan.json'),JSON.stringify({filesScanned:inventory.length,rules:Object.keys(rules),hits},null,2));
fs.writeFileSync(path.join(__dirname,'secret-scan-redacted.json'),JSON.stringify({scope:'Current source and environment tracking; no git history, build artifacts or dependency source scan',heuristic:true,candidates:secrets,environments:envSummary},null,2));
fs.writeFileSync(path.join(__dirname,'installed-versions.json'),JSON.stringify(versions,null,2));
console.log(JSON.stringify({filesScanned:inventory.length,patternHits:hits.length,secretCandidates:secrets,environments:envSummary,largestFiles:inventory.filter(f=>!f.path.includes('spec.')&&!f.path.includes('migration')).sort((a,b)=>b.lines-a.lines).slice(0,12).map(({repo,path,lines})=>({repo,path,lines}))},null,2));
