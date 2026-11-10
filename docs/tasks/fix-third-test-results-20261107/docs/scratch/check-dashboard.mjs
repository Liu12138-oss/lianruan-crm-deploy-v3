import { resolve } from "node:path";
import { chromium } from "playwright";
const b=await chromium.launch({headless:true});
const c=await b.newContext({baseURL:"http://10.9.86.66",viewport:{width:1600,height:1000}});
const p=await c.newPage();
p.on("console",m=>{if(m.type()==="error")console.log("CONSOLE",m.text())});
p.on("pageerror",e=>console.log("PAGEERROR",e.message));
await p.goto("/login",{waitUntil:"domcontentloaded"});
await p.locator('input[autocomplete="username"]').fill("zuomeijun");
await p.locator('input[autocomplete="current-password"]').fill("LrCRM@2026!");
await Promise.all([p.waitForURL(u=>!u.pathname.startsWith("/login"),{timeout:30000}),p.getByRole("button",{name:/登\s*录/}).click()]);
await p.waitForTimeout(1500);
console.log("login url",p.url());
await p.goto("/partner/dashboard",{waitUntil:"domcontentloaded"});
for(let i=0;i<15;i++){await p.waitForTimeout(1000); const t=(await p.locator("body").innerText()).replace(/\s+/g," "); if(!t.includes("正在加载工作台数据")&&!t.includes("数据加载中")){console.log("loaded after",i+1,"s");break;}}
console.log((await p.locator("body").innerText()).replace(/\s+/g," ").slice(0,2500));
await p.screenshot({path:resolve("docs/tasks/fix-third-test-results-20261107/docs/scratch/probe-output-third-r1/截图/渠道-渠道工作台-加载后.png"),fullPage:true});
await b.close();
