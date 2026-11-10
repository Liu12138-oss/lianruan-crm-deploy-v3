import { chromium } from "playwright";
const base="http://10.9.86.66";
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({baseURL:base,viewport:{width:1600,height:1000}});
const p=await ctx.newPage();
await p.goto("/login",{waitUntil:"domcontentloaded"});
await p.locator('input[autocomplete="username"]').fill("liulonghai");
await p.locator('input[autocomplete="current-password"]').fill("LrCRM@2026!");
await Promise.all([p.waitForURL(u=>!u.pathname.startsWith("/login"),{timeout:30000}),p.getByRole("button",{name:/登\s*录/}).click()]);
await p.waitForTimeout(1500);
const req=async(path,opt={})=>p.evaluate(async({path,opt})=>{const r=await fetch(path,{method:opt.method||"GET",credentials:"include",headers:opt.body?{"content-type":"application/json"}:{},...(opt.body?{body:JSON.stringify(opt.body)}:{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t.slice(0,500)}return{status:r.status,json:j,raw:t.slice(0,800)}}, {path,opt});

const uid="d7abd9f3-0f60-4168-8bca-9259b4669c5c";
const as=await req(`/api/org/assignments?userId=${uid}`);
console.log("assignments",as.status,JSON.stringify(as.json).slice(0,1500));
const all=await req(`/api/org/staff`);
console.log("staff sample",all.status, JSON.stringify((all.json?.data?.items||[]).filter(x=>String(x.userId||"").includes(uid))).slice(0,1200));

const tree=await req("/api/org/units/tree");
const flat=[];const walk=(n)=>{flat.push({id:n.id,unitName:n.unitName,statusCode:n.statusCode,regionId:n.regionId});(n.children||[]).forEach(walk)};(tree.json?.data?.items||[]).forEach(walk);
const hq=flat.find(x=>x.unitName==="联软总部");
const target=flat.find(x=>x.statusCode==="active"&&x.regionId&&x.unitName==="上海区（非金）") || flat.find(x=>x.statusCode==="active"&&x.regionId);
console.log("hq",JSON.stringify(hq),"target",JSON.stringify(target));

const create=await req(`/api/org/staff/${uid}/assignments`,{method:"POST",body:{orgUnitId:hq.id,isPrimary:true}});
console.log("assign create",create.status,create.raw);

// 重复外部身份
const dupUser=`third_e2e_dup_${Date.now()}`;
const dup=await req("/api/v2/users",{method:"POST",body:{username:dupUser,name:"重复身份诊断",role:"staff",status:"active",password:"Test@123456",eteamsUserId:"third-e2e-1794053337852",eteamsUsername:"dup"}});
console.log("dup create",dup.status,dup.raw);
await b.close();
