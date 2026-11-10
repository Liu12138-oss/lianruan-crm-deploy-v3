import { chromium } from "playwright";
const b=await chromium.launch({headless:true});const c=await b.newContext({baseURL:"http://10.9.86.66"});const p=await c.newPage();
await p.goto("/login",{waitUntil:"domcontentloaded"});
await p.locator('input[autocomplete="username"]').fill("liulonghai");await p.locator('input[autocomplete="current-password"]').fill("LrCRM@2026!");
await Promise.all([p.waitForURL(u=>!u.pathname.startsWith("/login")),p.getByRole("button",{name:/登\s*录/}).click()]);await p.waitForTimeout(1200);
const r=await p.evaluate(async()=>{const x=await fetch("/api/stage9/orders?page=1&pageSize=1",{credentials:"include"});return await x.json()});
console.log(JSON.stringify(r.data?.数据?.[0],null,2).slice(0,1500));
await b.close();
