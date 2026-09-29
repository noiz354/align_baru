/** Web-Mercator helpers for the vector basemap (256px tiles, zoom may be fractional). */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export const TILE = 256;

/** World pixel coordinates at a given zoom. */
export function project(p: LatLng, zoom: number): Pt {
  const s = TILE * Math.pow(2, zoom);
  const x = ((p.lng + 180) / 360) * s;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s;
  return { x, y };
}

export function unproject(pt: Pt, zoom: number): LatLng {
  const s = TILE * Math.pow(2, zoom);
  const lng = (pt.x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * pt.y) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Metres per screen pixel at the given latitude and zoom. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface ViewState {
  readonly center: LatLng;
  readonly zoom: number;
}

/** Screen-space converter for a viewport of width×height with the given view. */
export function makeScreen(view: ViewState, width: number, height: number) {
  const c = project(view.center, view.zoom);
  const toScreen = (p: LatLng): Pt => {
    const w = project(p, view.zoom);
    return { x: w.x - c.x + width / 2, y: w.y - c.y + height / 2 };
  };
  const fromScreen = (pt: Pt): LatLng =>
    unproject({ x: pt.x - width / 2 + c.x, y: pt.y - height / 2 + c.y }, view.zoom);
  return { toScreen, fromScreen };
}
