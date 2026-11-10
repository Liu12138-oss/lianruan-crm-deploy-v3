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
const req=async(path,opt={})=>p.evaluate(async({path,opt})=>{const r=await fetch(path,{method:opt.method||"GET",credentials:"include",headers:opt.body?{"content-type":"application/json"}:{},...(opt.body?{body:JSON.stringify(opt.body)}:{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t.slice(0,500)}return{status:r.status,json:j}}, {path,opt});

// ORG-10 DOM
await p.goto("/admin/organization/units",{waitUntil:"domcontentloaded"});await p.waitForTimeout(2500);
await p.getByText("管理配置",{exact:true}).first().hover();await p.waitForTimeout(500);
console.log("ORG10 DOM",await p.evaluate(()=>[...document.querySelectorAll("[class*=v2-一级导航]")].map(e=>({tag:e.tagName,cls:e.className,txt:(e.textContent||"").trim().slice(0,30)})).slice(0,20)));
console.log("active all",await p.evaluate(()=>[...document.querySelectorAll(".active")].map(e=>({tag:e.tagName,cls:e.className,txt:(e.textContent||"").trim().slice(0,30)})).filter(x=>String(x.cls).includes("导航")).slice(0,20)));

// AUD rows
const o=await req("/api/stage9/orders?page=1&pageSize=1");const no=o.json?.data?.数据?.[0]?.编号;console.log("order",no);
const a=await req(`/api/stage9/audit?keyword=${encodeURIComponent(no)}&page=1&pageSize=50`);
console.log("audit rows",a.status,a.json?.data?.数据?.map(x=>({标题:x.标题,编号:x.编号,原始:x.原始数据})));

// users row keys
const u=await req("/api/users?page=1&pageSize=1000");
const row=(u.json?.data?.数据||[]).find(x=>String(x.username||x.登录账号||"").startsWith("third_e2e_"));
console.log("user row",JSON.stringify(row,null,2).slice(0,1500));

// re-enable + assignment
const uid="d7abd9f3-0f60-4168-8bca-9259b4669c5c";
console.log("enable",await req(`/api/v2/users/${uid}/status`,{method:"PUT",body:{status:"active"}}));
const tree=await req("/api/org/units/tree");
const flat=[];const walk=(n)=>{flat.push(n);(n.children||[]).forEach(walk)};(tree.json?.data?.items||[]).forEach(walk);
const hq=flat.find(x=>x.unitName==="联软总部"); const target=flat.find(x=>x.id!==hq.id&&x.statusCode==="active"&&!x.regionId)||flat.find(x=>x.id!==hq.id&&x.statusCode==="active");
console.log("hq",hq?.id,"target",target?.id,target?.unitName);
const as=await req(`/api/org/staff/${uid}/assignments`,{method:"POST",body:{orgUnitId:hq.id,isPrimary:true}});
console.log("assign",as.status,JSON.stringify(as.json).slice(0,1000));
if(as.json?.data?.id){const mv=await req(`/api/org/assignments/${as.json.data.id}`,{method:"PUT",body:{orgUnitId:target.id,isPrimary:true,rowVersion:Number(as.json.data.rowVersion||1)}});console.log("move",mv.status,JSON.stringify(mv.json).slice(0,1000));}

// duplicate identity
const dup=await req("/api/v2/users",{method:"POST",body:{username:`third_e2e_dup_${Date.now()}`,name:"重复身份测试",role:"staff",status:"active",password:"Test@123456",eteamsUserId:"third-e2e-1794053337852",eteamsUsername:"dup"}});
console.log("dup",dup.status,JSON.stringify(dup.json).slice(0,1500));

// disable
console.log("disable",await req(`/api/v2/users/${uid}/status`,{method:"PUT",body:{status:"disabled"}}));
await b.close();
