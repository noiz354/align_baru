import type { GridZone, LL } from "./basemap-data";

/**
 * Deterministic city-block texture. Blocks are generated in local metres per zone,
 * rotated to the zone's street orientation, and returned as lat/lng polygons. The gaps
 * between blocks read as minor streets, which is how light basemaps convey urban fabric
 * without drawing every lane. Seeded PRNG ⇒ identical output on every render/screenshot.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const M_PER_DEG_LAT = 111_320;

export function generateBlocks(zone: GridZone): LL[][] {
  const rnd = mulberry32(zone.seed * 7919 + 17);
  const [sw, ne] = zone.bounds;
  const lat0 = sw[0];
  const lng0 = sw[1];
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(((sw[0] + ne[0]) / 2) * (Math.PI / 180));
  const W = (ne[1] - sw[1]) * mPerDegLng;
  const H = (ne[0] - sw[0]) * M_PER_DEG_LAT;
  const cx = W / 2;
  const cy = H / 2;
  const ang = (zone.angleDeg * Math.PI) / 180;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const [along, across] = zone.blockM;
  const gap = 16; // street width in metres
  const half = Math.hypot(W, H) / 2 + along;

  const out: LL[][] = [];
  const rows = Math.ceil((2 * half) / across);
  const cols = Math.ceil((2 * half) / along);

  for (let r = 0; r < rows; r++) {
    const v0 = -half + r * across;
    // per-row rhythm: occasionally a wider block row (market / institution)
    const rowScale = rnd() < 0.12 ? 1.6 : 1;
    let u = -half;
    for (let c = 0; c < cols && u < half; c++) {
      const len = along * (0.7 + rnd() * 0.7) * (rnd() < 0.08 ? 1.9 : 1);
      const u0 = u;
      u += len;
      if (rnd() > zone.density) continue;
      const wAcross = across * rowScale;
      // inset by half the street gap
      const a = u0 + gap / 2;
      const b = u - gap / 2;
      const c0 = v0 + gap / 2;
      const c1 = v0 + wAcross - gap / 2;
      if (b - a < 25 || c1 - c0 < 25) continue;
      const corners: [number, number][] = [
        [a, c0], [b, c0], [b, c1], [a, c1],
      ];
      const poly: LL[] = [];
      let inside = false;
      for (const [uu, vv] of corners) {
        // rotate back to metric east/north around zone centre
        const x = cx + uu * cos - vv * sin;
        const y = cy + uu * sin + vv * cos;
        if (x >= -40 && x <= W + 40 && y >= -40 && y <= H + 40) inside = true;
        poly.push([lat0 + y / M_PER_DEG_LAT, lng0 + x / mPerDegLng]);
      }
      if (inside) out.push(poly);
    }
  }
  return out;
}
