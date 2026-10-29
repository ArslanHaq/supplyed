const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const roots = {web: root, backend: path.resolve(root, '../supplyed-backend'), admin: path.resolve(root, '../supplyed-admin')};
const files = [];
function walk(dir, repo) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (['node_modules','.git','.next','dist','.aws','.codex','audit-evidence','deploy','.github'].includes(item.name) || item.name.startsWith('.env')) continue;
    const full = path.join(dir,item.name);
    if (item.isDirectory()) walk(full,repo);
    else if (/\.(tsx?|[cm]?js|prisma|sql)$/.test(item.name)) {
      const source = fs.readFileSync(full,'utf8');
      files.push({repo,path:path.relative(roots[repo],full).replaceAll('\\','/'),lines:source.split('\n').length,sha256:crypto.createHash('sha256').update(source).digest('hex')});
    }
  }
}
for (const [repo,dir] of Object.entries(roots)) walk(dir,repo);
const routes = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(roots[file.repo],file.path),'utf8');
  if (/\/page\.tsx$/.test(file.path)) routes.push({...file,type:'page',route:'/'+file.path.replace(/^app\//,'').replace(/\/page\.tsx$/,'').replace(/\([^/]+\)\//g,'').replace(/^\([^/]+\)$/,'')});
  if (/^app\/.*\/route\.ts$/.test(file.path)) routes.push({...file,type:'BFF',route:'/'+file.path.replace(/^app\//,'').replace(/\/route\.ts$/,''),methods:file.path.includes('[...nextauth]')?['GET','POST']:[...source.matchAll(/(?:function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE)\b/g)].map(m=>m[1])});
  if (/controller\.ts$/.test(file.path)) {
    let prefix='';
    source.split('\n').forEach((line,i)=>{const controller=/@Controller\((?:['"`]([^'"`]*)['"`])?\)/.exec(line);if(controller)prefix=controller[1]||'';const match = /@(Get|Post|Put|Patch|Delete)\((?:['"`]([^'"`]*)['"`])?\)/.exec(line);if(match)routes.push({repo:file.repo,path:file.path,line:i+1,type:'API',method:match[1].toUpperCase(),route:'/api/'+[prefix,match[2]].filter(Boolean).join('/')});});
  }
}
fs.writeFileSync(path.join(__dirname,'source-inventory.json'),JSON.stringify(files,null,2));
fs.writeFileSync(path.join(__dirname,'route-inventory.json'),JSON.stringify(routes,null,2));
console.log(JSON.stringify(Object.keys(roots).map(repo=>({repo,files:files.filter(f=>f.repo===repo).length,lines:files.filter(f=>f.repo===repo).reduce((a,f)=>a+f.lines,0),pages:routes.filter(f=>f.repo===repo&&f.type==='page').length,bff:routes.filter(f=>f.repo===repo&&f.type==='BFF').length,endpoints:routes.filter(f=>f.repo===repo&&f.type==='API').length})),null,2));
