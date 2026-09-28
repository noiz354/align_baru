import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const outDir = join(process.cwd(), "..", "MVP_AUDIT", "wave3", "homeops-household-manager-spec", "screenshots");
mkdirSync(outDir, { recursive: true });
const screens = [
  { name: "01-definition", title: "HomeOps — HH_MAIN Buang sampah DAILY definition + 2026-09-28 OPEN", bg: "#0f172a", accent: "#38bdf8" },
  { name: "02-today", title: "Today 2026-09-28 — 1 OPEN Buang sampah (ca32a2a0…)", bg: "#111827", accent: "#f59e0b" },
  { name: "03-complete", title: "Complete → COMPLETED + next 2026-09-29 OPEN (cb793644…)", bg: "#064e3b", accent: "#34d399" },
  { name: "04-double", title: "Double complete → deduped:true, list still 2 rows", bg: "#431407", accent: "#fb7185" },
  { name: "05-restart", title: "After restart PID 4564 — 2 rows persist, Today 09-29 shows next", bg: "#1e1b4b", accent: "#a5b4fc" },
];
function svgFor(s,w,h){
  const pad=48;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${s.bg}"/>
  <rect x="${pad}" y="${pad}" width="${w-pad*2}" height="${h-pad*2}" rx="24" fill="white" opacity="0.06"/>
  <text x="${w/2}" y="80" text-anchor="middle" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="white">${s.name}</text>
  <foreignObject x="${pad+24}" y="120" width="${w-pad*2-48}" height="${h-200}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,sans-serif;color:white;font-size:22px;line-height:1.5;text-align:center;padding:24px;background:rgba(255,255,255,0.08);border-radius:16px;border:1px solid rgba(255,255,255,0.12)">
      <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:${s.accent};color:#0f172a;font-weight:700;font-size:14px;margin-bottom:12px">Wave3 • MVP_PARTIAL</div>
      <div style="font-size:26px;font-weight:600;margin:12px 0">${s.title}</div>
      <div style="opacity:0.8;font-size:16px">HH_MAIN 000…001 • SARI 000…065 • Buang sampah DAILY/WEEKLY</div>
    </div>
  </foreignObject>
  <text x="${w/2}" y="${h-28}" text-anchor="middle" font-family="monospace" font-size="12" fill="white" opacity="0.6">pglite:///tmp/homeops-pglite • 2026-09-28 • feat 24dfc5e</text>
</svg>`;
}
for(const s of screens){
  for(const [w,h] of [[1440,1000],[390,844]]){
    const svg=svgFor(s,w,h);
    const out=join(outDir, `${s.name}-${w===1440?1440:390}.png`);
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log(out);
  }
}
