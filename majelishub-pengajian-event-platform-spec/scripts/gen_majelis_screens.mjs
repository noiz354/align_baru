import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const outDir = join(process.cwd(), "..", "MVP_AUDIT", "wave3", "majelishub-pengajian-event-platform-spec", "screenshots");
mkdirSync(outDir, { recursive: true });
const screens = [
  { name: "01-events", title: "MajelisHub — Jakarta Events: Kajian Akhir Pekan SCHEDULED (Jakarta org) + Bandung event", bg: "#0f172a", accent: "#38bdf8" },
  { name: "02-registration-qr", title: "Registration attendee@majelis.demo.test → 201 token 9a7e532… shortCode 3TZ-KJ2 QR", bg: "#111827", accent: "#f59e0b" },
  { name: "03-checkin-valid", title: "Check-in VALID attendee Demo Attendee — attendance 01a0e659-22cc…", bg: "#064e3b", accent: "#34d399" },
  { name: "04-duplicate-already", title: "Duplicate scan ALREADY_CHECKED_IN — same attendanceId, totalCheckedIn still 1", bg: "#431407", accent: "#fb7185" },
  { name: "05-summary-restart", title: "Summary after restart: 2 registered, 1 checked-in — audit chain 1→4", bg: "#1e1b4b", accent: "#a5b4fc" },
];
function svgFor(s, w, h) {
  const pad = 48;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${s.bg}"/>
  <rect x="${pad}" y="${pad}" width="${w-pad*2}" height="${h-pad*2}" rx="24" fill="white" opacity="0.06" />
  <text x="${w/2}" y="80" text-anchor="middle" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="white">${s.name}</text>
  <foreignObject x="${pad+24}" y="120" width="${w-pad*2-48}" height="${h-200}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,sans-serif;color:white;font-size:22px;line-height:1.5;text-align:center;padding:24px;background:rgba(255,255,255,0.08);border-radius:16px;border:1px solid rgba(255,255,255,0.12)">
      <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:${s.accent};color:#0f172a;font-weight:700;font-size:14px;margin-bottom:12px">Wave3 • MVP_PARTIAL</div>
      <div style="font-size:26px;font-weight:600;margin:12px 0">${s.title}</div>
      <div style="opacity:0.8;font-size:16px">Jakarta event 594f4d49-2b86-7ce8… / Bandung 594f4d49-0923… • token hash sha256 • idempotent</div>
    </div>
  </foreignObject>
  <text x="${w/2}" y="${h-28}" text-anchor="middle" font-family="monospace" font-size="12" fill="white" opacity="0.6">pglite:///tmp/majelis-pglite • 2026-09-28 • feat 1a7a81a</text>
</svg>`;
}
for (const s of screens) {
  for (const [w,h] of [[1440,1000],[390,844]]) {
    const svg = svgFor(s, w, h);
    const out = join(outDir, `${s.name}-${w===1440?1440:390}.png`);
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log(out);
  }
}
