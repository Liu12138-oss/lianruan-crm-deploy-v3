import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.dirname(fileURLToPath(import.meta.url));
const evidence = JSON.parse(await fs.readFile(path.join(base, "PROTOTYPE-EVIDENCE.json"), "utf8"));

const title = (file) =>
  file
    .replace(/\.png$/u, "")
    .replace(/^\d+-/u, "")
    .replaceAll("-", " ");

const pageCards = evidence.pages
  .map(
    (file, index) => `<button class="card" type="button" data-image="screenshots/${file}">
      <span class="card-no">PAGE ${String(index + 1).padStart(2, "0")}</span>
      <img src="screenshots/${file}" alt="${title(file)}" loading="lazy" />
      <strong>${title(file)}</strong>
      <small>${file}</small>
    </button>`,
  )
  .join("");

const windowCards = evidence.windows
  .map(
    (
      file,
      index,
    ) => `<button class="card" type="button" data-image="screenshots/windows-v3/${file}">
      <span class="card-no">WINDOW ${String(index + 1).padStart(2, "0")}</span>
      <img src="screenshots/windows-v3/${file}" alt="${title(file)}" loading="lazy" />
      <strong>${title(file)}</strong>
      <small>${file}</small>
    </button>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>V3 UI 原型画廊</title>
    <style>
      :root { color-scheme: light; --blue:#2f69ed; --deep:#17345e; --text:#172b4d; --muted:#7d8da2; --line:#dce7f3; --page:#eef4fa; }
      * { box-sizing:border-box; }
      body { margin:0; background:linear-gradient(180deg,#eef6fd,#e5eef8); color:var(--text); font:13px/1.45 "PingFang SC","Microsoft YaHei",system-ui,sans-serif; }
      header { position:sticky; z-index:5; top:0; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:18px 24px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.95); backdrop-filter:blur(12px); }
      h1 { margin:0; color:var(--deep); font-size:21px; }
      header p { margin:5px 0 0; color:var(--muted); font-size:12px; }
      .actions { display:flex; gap:8px; }
      .actions a, .actions button { min-height:34px; padding:0 14px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--deep); font-weight:800; text-decoration:none; }
      .actions a.primary { border-color:var(--blue); background:var(--blue); color:#fff; }
      main { padding:22px 24px 48px; }
      .tabs { display:flex; gap:8px; margin-bottom:18px; }
      .tabs button { min-height:38px; padding:0 18px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--muted); font-weight:800; }
      .tabs button.active { border-color:var(--blue); background:var(--blue); color:#fff; }
      .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
      .card { overflow:hidden; padding:0; border:1px solid var(--line); border-radius:10px; background:#fff; text-align:left; box-shadow:0 10px 24px rgba(36,75,119,.06); }
      .card:hover { transform:translateY(-2px); border-color:#adc9f4; }
      .card img { display:block; width:100%; aspect-ratio:16/10; object-fit:cover; object-position:top center; background:var(--page); }
      .card-no { display:block; margin:10px 11px 0; color:var(--blue); font-size:9px; font-weight:900; }
      .card strong { display:block; margin:5px 11px 0; font-size:11px; }
      .card small { display:block; margin:3px 11px 11px; overflow:hidden; color:var(--muted); font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
      .hidden { display:none !important; }
      .viewer { position:fixed; z-index:20; inset:0; display:grid; place-items:center; padding:28px; background:rgba(15,35,61,.82); }
      .viewer img { max-width:min(1500px,96vw); max-height:90vh; border-radius:8px; background:#fff; box-shadow:0 30px 80px rgba(0,0,0,.3); }
      .viewer button { position:fixed; top:18px; right:22px; width:38px; height:38px; border:0; border-radius:9px; background:#fff; color:var(--deep); font-size:20px; }
    </style>
  </head>
  <body>
    <header>
      <div><h1>V3 UI 原型画廊</h1><p>${evidence.pageCount} 个主页面 · ${evidence.windowCount} 个关键窗口 · ${evidence.generatedAt}</p></div>
      <div class="actions"><a class="primary" href="index.html">打开交互原型</a><a href="PROTOTYPE-EVIDENCE.json" target="_blank">查看证据清单</a></div>
    </header>
    <main>
      <div class="tabs"><button class="active" type="button" data-target="pages">主页面 ${evidence.pageCount}</button><button type="button" data-target="windows">关键窗口 ${evidence.windowCount}</button></div>
      <section id="pages" class="grid">${pageCards}</section>
      <section id="windows" class="grid hidden">${windowCards}</section>
    </main>
    <div id="viewer" class="viewer hidden"><button type="button" aria-label="关闭">×</button><img src="screenshots/${evidence.pages[0]}" alt="原型大图" /></div>
    <script>
      document.querySelectorAll(".tabs button").forEach((button) => button.addEventListener("click", () => {
        document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
        document.querySelectorAll("main > section").forEach((section) => section.classList.toggle("hidden", section.id !== button.dataset.target));
      }));
      const viewer = document.querySelector("#viewer");
      const viewerImage = viewer.querySelector("img");
      document.querySelectorAll(".card").forEach((card) => card.addEventListener("click", () => {
        viewerImage.src = card.dataset.image;
        viewer.classList.remove("hidden");
      }));
      viewer.addEventListener("click", () => viewer.classList.add("hidden"));
      document.addEventListener("keydown", (event) => { if (event.key === "Escape") viewer.classList.add("hidden"); });
    </script>
  </body>
</html>
`;

await fs.writeFile(path.join(base, "gallery.html"), html, "utf8");
console.log(
  `Generated gallery.html with ${evidence.pageCount} pages and ${evidence.windowCount} windows.`,
);
