/**
 * Schematic vector basemap of South / Central Jakarta for the operations map.
 *
 * Geometry is hand-digitised and indicative (major corridors, rail, rivers, parks and
 * district labels) — it is NOT survey data and must not be used for navigation. It exists
 * so the HQ console renders a recognisable Jakarta without third-party tile servers
 * (CSP `img-src 'self'`, no external SDKs — SECURITY.md, ADR-0007).
 *
 * All coordinates are [lat, lng].
 */

export type LL = readonly [number, number];

export type WayClass = "toll" | "arterial" | "secondary" | "local" | "rail" | "mrt" | "river" | "canal";

export interface Way {
  readonly cls: WayClass;
  readonly name?: string;
  readonly pts: readonly LL[];
  /** Whether to render the name along the path. */
  readonly label?: boolean;
  /** Offset of the label start along the path, 0–100 (%). */
  readonly labelOffset?: number;
}

export type AreaClass = "park" | "cemetery" | "water" | "campus" | "commercial";

export interface Area {
  readonly cls: AreaClass;
  readonly name?: string;
  readonly pts: readonly LL[];
}

export interface Place {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  /** 1 = district, 2 = neighbourhood, 3 = minor locality */
  readonly rank: 1 | 2 | 3;
}

export interface Station {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export const WAYS: readonly Way[] = [
  // ---------- Rivers & canals ----------
  {
    cls: "river", name: "Kali Ciliwung", label: true, labelOffset: 22,
    pts: [
      [-6.312, 106.848], [-6.302, 106.852], [-6.294, 106.856], [-6.286, 106.854], [-6.279, 106.858],
      [-6.271, 106.856], [-6.263, 106.860], [-6.256, 106.858], [-6.250, 106.862], [-6.244, 106.864],
      [-6.238, 106.866], [-6.232, 106.864], [-6.226, 106.862], [-6.221, 106.858], [-6.216, 106.856],
      [-6.211, 106.853], [-6.2075, 106.851], [-6.202, 106.849], [-6.196, 106.848], [-6.190, 106.846],
      [-6.184, 106.843], [-6.178, 106.840], [-6.170, 106.838],
    ],
  },
  {
    cls: "canal", name: "Banjir Kanal Barat", label: true, labelOffset: 30,
    pts: [
      [-6.2075, 106.851], [-6.2065, 106.845], [-6.2055, 106.838], [-6.205, 106.832], [-6.2055, 106.826],
      [-6.2075, 106.820], [-6.206, 106.815], [-6.203, 106.810], [-6.197, 106.806], [-6.190, 106.802], [-6.182, 106.800],
    ],
  },
  {
    cls: "canal", name: "Kali Krukut",
    pts: [
      [-6.275, 106.812], [-6.266, 106.814], [-6.258, 106.817], [-6.250, 106.820], [-6.243, 106.822],
      [-6.236, 106.822], [-6.229, 106.8215], [-6.222, 106.8205], [-6.215, 106.819], [-6.2075, 106.818],
    ],
  },
  {
    cls: "canal", name: "Kali Malang",
    pts: [[-6.2455, 106.874], [-6.2455, 106.890], [-6.2445, 106.910], [-6.2440, 106.930]],
  },
  {
    cls: "canal", name: "Kali Cipinang",
    pts: [[-6.300, 106.882], [-6.285, 106.884], [-6.270, 106.886], [-6.255, 106.889], [-6.240, 106.890], [-6.225, 106.892], [-6.210, 106.893]],
  },

  // ---------- Toll roads ----------
  {
    cls: "toll", name: "Tol Dalam Kota", label: true, labelOffset: 16,
    pts: [
      [-6.208, 106.790], [-6.212, 106.797], [-6.2185, 106.806], [-6.2195, 106.8135], [-6.2255, 106.819],
      [-6.2325, 106.8265], [-6.2385, 106.8345], [-6.2425, 106.8425], [-6.2440, 106.852], [-6.2445, 106.8605],
      [-6.2450, 106.870], [-6.2455, 106.880],
    ],
  },
  {
    cls: "toll", name: "Tol Jagorawi", label: true, labelOffset: 40,
    pts: [[-6.2455, 106.880], [-6.256, 106.874], [-6.270, 106.878], [-6.290, 106.882], [-6.312, 106.886]],
  },
  {
    cls: "toll", name: "Tol Jakarta–Cikampek",
    pts: [[-6.2455, 106.880], [-6.2452, 106.900], [-6.2445, 106.920], [-6.244, 106.940]],
  },
  {
    cls: "toll", name: "Tol Wiyoto Wiyono",
    pts: [[-6.2455, 106.880], [-6.235, 106.876], [-6.225, 106.876], [-6.215, 106.877], [-6.200, 106.879], [-6.180, 106.881]],
  },
  {
    cls: "toll", name: "Tol Lingkar Luar (JORR)", label: true, labelOffset: 30,
    pts: [[-6.2935, 106.790], [-6.2960, 106.812], [-6.2975, 106.830], [-6.2990, 106.844], [-6.3020, 106.850], [-6.3060, 106.865], [-6.3080, 106.880]],
  },

  // ---------- Arterials ----------
  {
    cls: "arterial", name: "Jl. Jend. Sudirman", label: true, labelOffset: 40,
    pts: [
      [-6.168, 106.8275], [-6.182, 106.8235], [-6.1935, 106.823], [-6.2010, 106.8225], [-6.210, 106.8205],
      [-6.2195, 106.8135], [-6.2255, 106.8065], [-6.232, 106.802], [-6.2395, 106.7995], [-6.2445, 106.798], [-6.256, 106.7975],
    ],
  },
  {
    cls: "arterial", name: "Jl. Gatot Subroto", label: true, labelOffset: 24,
    pts: [
      [-6.212, 106.797], [-6.2185, 106.806], [-6.2200, 106.8135], [-6.2260, 106.819], [-6.2330, 106.8265],
      [-6.2390, 106.8345], [-6.2430, 106.8425],
    ],
  },
  {
    cls: "arterial", name: "Jl. MT Haryono", label: true, labelOffset: 30,
    pts: [[-6.2430, 106.8425], [-6.2445, 106.852], [-6.2450, 106.8605], [-6.2455, 106.870], [-6.2460, 106.880]],
  },
  {
    cls: "arterial", name: "Jl. HR Rasuna Said", label: true, labelOffset: 28,
    pts: [[-6.2055, 106.8335], [-6.2135, 106.8330], [-6.2245, 106.8318], [-6.2345, 106.8298]],
  },
  {
    cls: "arterial", name: "Jl. Prof. Dr. Satrio", label: true, labelOffset: 34,
    pts: [[-6.2215, 106.8165], [-6.2240, 106.8235], [-6.2245, 106.8320], [-6.2245, 106.8400]],
  },
  {
    cls: "arterial", name: "Jl. Casablanca", label: true, labelOffset: 20,
    pts: [[-6.2245, 106.8400], [-6.2240, 106.8480], [-6.2245, 106.8560], [-6.2250, 106.8625]],
  },
  {
    cls: "arterial", name: "Jl. Dr. Saharjo", label: true, labelOffset: 42,
    pts: [[-6.2090, 106.8495], [-6.2150, 106.8500], [-6.2240, 106.8503], [-6.2330, 106.8505], [-6.2415, 106.8485]],
  },
  {
    cls: "arterial", name: "Jl. Raya Pasar Minggu", label: true, labelOffset: 30,
    pts: [
      [-6.2430, 106.8425], [-6.2500, 106.8440], [-6.2600, 106.8450], [-6.2700, 106.8455], [-6.2800, 106.8445],
      [-6.2842, 106.8440], [-6.2950, 106.8420], [-6.312, 106.8400],
    ],
  },
  {
    cls: "arterial", name: "Jl. Mampang Prapatan", label: true, labelOffset: 22,
    pts: [[-6.2345, 106.8298], [-6.2400, 106.8280], [-6.2500, 106.8265], [-6.2600, 106.8275]],
  },
  {
    cls: "arterial", name: "Jl. Warung Buncit Raya", label: true, labelOffset: 30,
    pts: [[-6.2600, 106.8275], [-6.2700, 106.8270], [-6.2800, 106.8240], [-6.2900, 106.8215], [-6.305, 106.820]],
  },
  {
    cls: "arterial", name: "Jl. Kapten Tendean", label: true, labelOffset: 30,
    pts: [[-6.2400, 106.8280], [-6.2405, 106.8200], [-6.2400, 106.8120], [-6.2395, 106.8055], [-6.2405, 106.7995]],
  },
  {
    cls: "arterial", name: "Jl. Diponegoro", label: true, labelOffset: 40,
    pts: [[-6.1955, 106.8225], [-6.1975, 106.8280], [-6.1980, 106.8350], [-6.1985, 106.8420], [-6.1990, 106.8470], [-6.1995, 106.8510]],
  },
  {
    cls: "arterial", name: "Jl. Pramuka", label: true, labelOffset: 40,
    pts: [[-6.1995, 106.8510], [-6.1985, 106.8600], [-6.1975, 106.8700], [-6.1965, 106.8850]],
  },
  {
    cls: "arterial", name: "Jl. Salemba Raya", label: true, labelOffset: 20,
    pts: [[-6.1800, 106.8465], [-6.1880, 106.8500], [-6.1955, 106.8510], [-6.2000, 106.8515]],
  },
  {
    cls: "arterial", name: "Jl. Matraman Raya", label: true, labelOffset: 20,
    pts: [[-6.2000, 106.8515], [-6.2060, 106.8580], [-6.2120, 106.8630], [-6.2180, 106.8665]],
  },
  {
    cls: "arterial", name: "Jl. Otto Iskandardinata", label: true, labelOffset: 30,
    pts: [[-6.2180, 106.8665], [-6.2245, 106.8650], [-6.2320, 106.8665], [-6.2400, 106.8680], [-6.2455, 106.8700]],
  },
  {
    cls: "arterial", name: "Jl. Jatinegara Timur",
    pts: [[-6.2180, 106.8665], [-6.2170, 106.880], [-6.2160, 106.900], [-6.2150, 106.925]],
  },
  {
    cls: "arterial", name: "Jl. DI Panjaitan", label: true, labelOffset: 30,
    pts: [[-6.1975, 106.8790], [-6.2200, 106.8795], [-6.2455, 106.8790]],
  },
  {
    cls: "arterial", name: "Jl. Mayjen Sutoyo",
    pts: [[-6.2455, 106.8790], [-6.2600, 106.8820], [-6.2750, 106.8850], [-6.290, 106.887]],
  },
  {
    cls: "arterial", name: "Jl. TB Simatupang", label: true, labelOffset: 20,
    pts: [[-6.2925, 106.790], [-6.2950, 106.812], [-6.2965, 106.830], [-6.2980, 106.844], [-6.3010, 106.850], [-6.3050, 106.865], [-6.3070, 106.880]],
  },
  {
    cls: "arterial", name: "Jl. Sultan Agung", label: true, labelOffset: 20,
    pts: [[-6.2075, 106.8340], [-6.2085, 106.8420], [-6.2090, 106.8495], [-6.2095, 106.8555], [-6.2120, 106.8630]],
  },
  {
    cls: "arterial", name: "Jl. Latuharhari",
    pts: [[-6.2035, 106.8235], [-6.2045, 106.8300], [-6.2055, 106.8340]],
  },
  {
    cls: "arterial", name: "Jl. MH Thamrin",
    pts: [[-6.1935, 106.823], [-6.186, 106.8245], [-6.1755, 106.8272]],
  },
  {
    cls: "arterial", name: "Jl. Sisingamangaraja",
    pts: [[-6.2445, 106.798], [-6.2500, 106.7960], [-6.2600, 106.7955]],
  },
  {
    cls: "arterial", name: "Jl. Pangeran Antasari",
    pts: [[-6.2405, 106.7995], [-6.2500, 106.8050], [-6.2600, 106.8075], [-6.2750, 106.8070], [-6.2925, 106.8040]],
  },

  // ---------- Secondary roads ----------
  { cls: "secondary", name: "Jl. Tebet Raya", label: true, labelOffset: 40, pts: [[-6.2262, 106.8545], [-6.2310, 106.8550], [-6.2360, 106.8555], [-6.2435, 106.8560]] },
  { cls: "secondary", name: "Jl. Tebet Timur Raya", pts: [[-6.2262, 106.8590], [-6.2320, 106.8598], [-6.2400, 106.8605], [-6.2440, 106.8600]] },
  { cls: "secondary", name: "Jl. Tebet Barat Dalam Raya", pts: [[-6.2300, 106.8505], [-6.2320, 106.8535], [-6.2360, 106.8535], [-6.2400, 106.8520]] },
  { cls: "secondary", name: "Jl. Tebet Utara", pts: [[-6.2300, 106.8505], [-6.2300, 106.8555], [-6.2300, 106.8605]] },
  { cls: "secondary", name: "Jl. Denpasar Raya", pts: [[-6.2300, 106.8310], [-6.2290, 106.8250], [-6.2270, 106.8215], [-6.2250, 106.8190]] },
  { cls: "secondary", name: "Jl. Mega Kuningan", pts: [[-6.2262, 106.8232], [-6.2250, 106.8262], [-6.2262, 106.8292], [-6.2288, 106.8298], [-6.2306, 106.8270], [-6.2296, 106.8240], [-6.2278, 106.8228], [-6.2262, 106.8232]] },
  { cls: "secondary", name: "Jl. Setiabudi Raya", pts: [[-6.2100, 106.8235], [-6.2110, 106.8290], [-6.2120, 106.8330]] },
  { cls: "secondary", name: "Jl. Karet Pedurenan", pts: [[-6.2145, 106.8205], [-6.2190, 106.8250], [-6.2235, 106.8290]] },
  { cls: "secondary", name: "Jl. Cikini Raya", label: true, labelOffset: 20, pts: [[-6.1855, 106.8375], [-6.1920, 106.8400], [-6.1975, 106.8412], [-6.2045, 106.8440]] },
  { cls: "secondary", name: "Jl. Proklamasi", pts: [[-6.2000, 106.8420], [-6.2005, 106.8480], [-6.2010, 106.8540]] },
  { cls: "secondary", name: "Jl. Teuku Umar", pts: [[-6.1975, 106.8280], [-6.1930, 106.8300], [-6.1895, 106.8320], [-6.1855, 106.8305]] },
  { cls: "secondary", name: "Jl. HOS Cokroaminoto", pts: [[-6.1955, 106.8225], [-6.1965, 106.8300], [-6.1975, 106.8370]] },
  { cls: "secondary", name: "Jl. Kramat Raya", pts: [[-6.1880, 106.8500], [-6.1800, 106.8465], [-6.172, 106.8445]] },
  { cls: "secondary", name: "Jl. Minangkabau", pts: [[-6.2085, 106.8420], [-6.2130, 106.8455], [-6.2180, 106.8470]] },
  { cls: "secondary", name: "Jl. Bukit Duri Tanjakan", pts: [[-6.2140, 106.8560], [-6.2200, 106.8580], [-6.2262, 106.8590]] },
  { cls: "secondary", name: "Jl. Kalibata Raya", label: true, labelOffset: 30, pts: [[-6.2600, 106.8450], [-6.2585, 106.8340], [-6.2600, 106.8275]] },
  { cls: "secondary", name: "Jl. Duren Tiga Raya", pts: [[-6.2500, 106.8440], [-6.2530, 106.8380], [-6.2555, 106.8330]] },
  { cls: "secondary", name: "Jl. Pejaten Raya", label: true, labelOffset: 30, pts: [[-6.2750, 106.8260], [-6.2760, 106.8400], [-6.2800, 106.8445]] },
  { cls: "secondary", name: "Jl. Pejaten Barat", pts: [[-6.2700, 106.8270], [-6.2720, 106.8330], [-6.2760, 106.8400]] },
  { cls: "secondary", name: "Jl. Kemang Raya", label: true, labelOffset: 20, pts: [[-6.2400, 106.8145], [-6.2500, 106.8140], [-6.2600, 106.8130], [-6.2700, 106.8115], [-6.2800, 106.8135]] },
  { cls: "secondary", name: "Jl. Bangka Raya", pts: [[-6.2500, 106.8140], [-6.2530, 106.8200], [-6.2555, 106.8265]] },
  { cls: "secondary", name: "Jl. Ampera Raya", pts: [[-6.2700, 106.8270], [-6.2780, 106.8180], [-6.2880, 106.8100]] },
  { cls: "secondary", name: "Jl. Dewi Sartika", pts: [[-6.2455, 106.8680], [-6.2620, 106.8680], [-6.2780, 106.8660]] },
  { cls: "secondary", name: "Jl. Pancoran Barat", pts: [[-6.2430, 106.8425], [-6.2470, 106.8380], [-6.2520, 106.8330]] },
  { cls: "secondary", name: "Jl. Rawajati", pts: [[-6.2500, 106.8440], [-6.2560, 106.8500], [-6.2600, 106.8560]] },
  { cls: "secondary", name: "Jl. Asia Afrika", pts: [[-6.2135, 106.8085], [-6.2200, 106.8090], [-6.2265, 106.8035]] },
  { cls: "secondary", name: "Jl. Gerbang Pemuda", pts: [[-6.2125, 106.7995], [-6.2135, 106.8085]] },
  { cls: "secondary", name: "Jl. Kebayoran Baru", pts: [[-6.2395, 106.8055], [-6.2500, 106.8000]] },
  { cls: "secondary", name: "Jl. Jatinegara Barat", pts: [[-6.2120, 106.8630], [-6.2180, 106.8665]] },
  { cls: "secondary", name: "Jl. Bekasi Barat", pts: [[-6.2245, 106.8650], [-6.2240, 106.8800], [-6.2235, 106.8950]] },
  { cls: "secondary", name: "Jl. Cipinang Cempedak", pts: [[-6.2320, 106.8665], [-6.2330, 106.8800], [-6.2340, 106.8950]] },
  { cls: "secondary", name: "Jl. Condet Raya", pts: [[-6.2780, 106.8660], [-6.2900, 106.8600], [-6.3050, 106.8600]] },
  { cls: "secondary", name: "Jl. Tanjung Barat", pts: [[-6.2950, 106.8420], [-6.3000, 106.8500], [-6.3080, 106.8560]] },
  { cls: "secondary", name: "Jl. Kebagusan", pts: [[-6.2900, 106.8215], [-6.2920, 106.8330], [-6.2950, 106.8420]] },
  { cls: "secondary", name: "Jl. Kwitang", pts: [[-6.1855, 106.8375], [-6.1830, 106.8320], [-6.1800, 106.8280]] },
  { cls: "secondary", name: "Jl. Menteng Raya", pts: [[-6.1855, 106.8305], [-6.1865, 106.8360], [-6.1880, 106.8420]] },

  // ---------- Rail ----------
  {
    cls: "rail", name: "KRL Bogor",
    pts: [
      [-6.1700, 106.8310], [-6.1767, 106.8306], [-6.1865, 106.8330], [-6.1975, 106.8412], [-6.2099, 106.8503],
      [-6.2260, 106.8583], [-6.2426, 106.8590], [-6.2554, 106.8551], [-6.2687, 106.8515], [-6.2842, 106.8444],
      [-6.3070, 106.8390], [-6.318, 106.836],
    ],
  },
  { cls: "rail", name: "KRL Cikarang", pts: [[-6.2099, 106.8503], [-6.2125, 106.8600], [-6.2150, 106.8700], [-6.2150, 106.8900], [-6.2140, 106.9200]] },
  { cls: "rail", name: "KRL Lingkar", pts: [[-6.2099, 106.8503], [-6.2075, 106.845], [-6.2040, 106.8330], [-6.2025, 106.8233], [-6.2010, 106.8175], [-6.1857, 106.8106], [-6.1750, 106.8050]] },
  { cls: "mrt", name: "MRT", pts: [[-6.1918, 106.8230], [-6.2010, 106.8225], [-6.2093, 106.8215], [-6.2150, 106.8180], [-6.2224, 106.8085], [-6.2266, 106.8025], [-6.2388, 106.7985], [-6.2443, 106.7980], [-6.2555, 106.7975]] },
];

export const AREAS: readonly Area[] = [
  { cls: "park", name: "GBK Senayan", pts: [[-6.2125, 106.7995], [-6.2135, 106.8085], [-6.2200, 106.8090], [-6.2265, 106.8035], [-6.2265, 106.7990]] },
  { cls: "park", name: "Taman Menteng", pts: [[-6.1945, 106.8285], [-6.1945, 106.8310], [-6.1968, 106.8310], [-6.1968, 106.8285]] },
  { cls: "park", name: "Taman Suropati", pts: [[-6.1982, 106.8320], [-6.1982, 106.8342], [-6.2000, 106.8342], [-6.2000, 106.8320]] },
  { cls: "park", name: "Taman Honda Tebet", pts: [[-6.2345, 106.8505], [-6.2345, 106.8528], [-6.2372, 106.8528], [-6.2372, 106.8505]] },
  { cls: "park", name: "Monas", pts: [[-6.1715, 106.8230], [-6.1715, 106.8315], [-6.1795, 106.8315], [-6.1795, 106.8230]] },
  { cls: "park", name: "Ragunan", pts: [[-6.3050, 106.8130], [-6.3050, 106.8260], [-6.3200, 106.8260], [-6.3200, 106.8130]] },
  { cls: "cemetery", name: "TPU Menteng Pulo", pts: [[-6.2265, 106.8395], [-6.2265, 106.8440], [-6.2320, 106.8445], [-6.2325, 106.8400]] },
  { cls: "cemetery", name: "TMP Kalibata", pts: [[-6.2575, 106.8455], [-6.2570, 106.8520], [-6.2650, 106.8525], [-6.2650, 106.8460]] },
  { cls: "cemetery", name: "TPU Karet Bivak", pts: [[-6.2075, 106.8155], [-6.2075, 106.8200], [-6.2130, 106.8200], [-6.2130, 106.8155]] },
  { cls: "campus", name: "UI Salemba", pts: [[-6.1955, 106.8480], [-6.1955, 106.8510], [-6.1980, 106.8510], [-6.1980, 106.8480]] },
  { cls: "commercial", name: "Mega Kuningan", pts: [[-6.2262, 106.8232], [-6.2250, 106.8262], [-6.2262, 106.8292], [-6.2288, 106.8298], [-6.2306, 106.8270], [-6.2296, 106.8240], [-6.2278, 106.8228]] },
  { cls: "commercial", name: "SCBD", pts: [[-6.2225, 106.8080], [-6.2225, 106.8115], [-6.2270, 106.8115], [-6.2270, 106.8080]] },
  { cls: "water", name: "Waduk Setiabudi Barat", pts: [[-6.2098, 106.8240], [-6.2098, 106.8268], [-6.2128, 106.8268], [-6.2128, 106.8240]] },
  { cls: "water", name: "Waduk Setiabudi Timur", pts: [[-6.2100, 106.8280], [-6.2100, 106.8306], [-6.2130, 106.8306], [-6.2130, 106.8280]] },
  { cls: "water", name: "Waduk Melati", pts: [[-6.1955, 106.8175], [-6.1955, 106.8195], [-6.1975, 106.8195], [-6.1975, 106.8175]] },
];

export const PLACES: readonly Place[] = [
  { name: "Cikini", lat: -6.1915, lng: 106.8415, rank: 1 },
  { name: "Menteng", lat: -6.1972, lng: 106.8318, rank: 1 },
  { name: "Setiabudi", lat: -6.2148, lng: 106.8262, rank: 1 },
  { name: "Kuningan", lat: -6.2318, lng: 106.8342, rank: 1 },
  { name: "Manggarai", lat: -6.2118, lng: 106.8508, rank: 1 },
  { name: "Tebet", lat: -6.2338, lng: 106.8570, rank: 1 },
  { name: "Pasar Minggu", lat: -6.2872, lng: 106.8448, rank: 1 },
  { name: "Mampang", lat: -6.2478, lng: 106.8248, rank: 1 },
  { name: "Kalibata", lat: -6.2598, lng: 106.8490, rank: 1 },
  { name: "Pancoran", lat: -6.2445, lng: 106.8470, rank: 2 },
  { name: "Kemang", lat: -6.2612, lng: 106.8130, rank: 1 },
  { name: "Senayan", lat: -6.2195, lng: 106.8035, rank: 1 },
  { name: "SCBD", lat: -6.2272, lng: 106.8098, rank: 2 },
  { name: "Blok M", lat: -6.2445, lng: 106.7990, rank: 1 },
  { name: "Salemba", lat: -6.1968, lng: 106.8535, rank: 1 },
  { name: "Matraman", lat: -6.2052, lng: 106.8612, rank: 2 },
  { name: "Jatinegara", lat: -6.2168, lng: 106.8718, rank: 1 },
  { name: "Kampung Melayu", lat: -6.2232, lng: 106.8665, rank: 2 },
  { name: "Bukit Duri", lat: -6.2178, lng: 106.8578, rank: 3 },
  { name: "Cawang", lat: -6.2478, lng: 106.8680, rank: 1 },
  { name: "Condet", lat: -6.2755, lng: 106.8600, rank: 2 },
  { name: "Pejaten", lat: -6.2745, lng: 106.8335, rank: 2 },
  { name: "Duren Tiga", lat: -6.2555, lng: 106.8370, rank: 3 },
  { name: "Warung Buncit", lat: -6.2688, lng: 106.8290, rank: 3 },
  { name: "Ragunan", lat: -6.2985, lng: 106.8225, rank: 2 },
  { name: "Tanjung Barat", lat: -6.3035, lng: 106.8410, rank: 2 },
  { name: "Karet", lat: -6.2142, lng: 106.8168, rank: 2 },
  { name: "Mega Kuningan", lat: -6.2278, lng: 106.8262, rank: 3 },
  { name: "Gambir", lat: -6.1768, lng: 106.8338, rank: 2 },
  { name: "Kwitang", lat: -6.1825, lng: 106.8385, rank: 3 },
  { name: "Cipinang", lat: -6.2255, lng: 106.8850, rank: 2 },
  { name: "Kramat Jati", lat: -6.2715, lng: 106.8710, rank: 2 },
  { name: "Kebayoran Baru", lat: -6.2515, lng: 106.8040, rank: 2 },
  { name: "Bendungan Hilir", lat: -6.2118, lng: 106.8130, rank: 3 },
  { name: "Guntur", lat: -6.2058, lng: 106.8415, rank: 3 },
  { name: "Cikoko", lat: -6.2478, lng: 106.8555, rank: 3 },
  { name: "Cililitan", lat: -6.2635, lng: 106.8700, rank: 3 },
  { name: "Pondok Bambu", lat: -6.2405, lng: 106.9080, rank: 2 },
  { name: "Duren Sawit", lat: -6.2270, lng: 106.9100, rank: 2 },
];

export const STATIONS: readonly Station[] = [
  { name: "Manggarai", lat: -6.2099, lng: 106.8503 },
  { name: "Tebet", lat: -6.2260, lng: 106.8583 },
  { name: "Cawang", lat: -6.2426, lng: 106.8590 },
  { name: "Duren Kalibata", lat: -6.2554, lng: 106.8551 },
  { name: "Pasar Minggu Baru", lat: -6.2687, lng: 106.8515 },
  { name: "Pasar Minggu", lat: -6.2842, lng: 106.8444 },
  { name: "Cikini", lat: -6.1975, lng: 106.8412 },
  { name: "Gondangdia", lat: -6.1865, lng: 106.8330 },
  { name: "Sudirman", lat: -6.2025, lng: 106.8233 },
  { name: "Karet", lat: -6.2010, lng: 106.8175 },
  { name: "Jatinegara", lat: -6.2150, lng: 106.8700 },
  { name: "Tanjung Barat", lat: -6.3070, lng: 106.8390 },
];

/**
 * Zones used to synthesise the minor street texture (deterministic). Each zone is a
 * rotated block grid; angles roughly follow the dominant street orientation of the
 * neighbourhood so kampung blocks read differently from the Menteng garden-city grid.
 */
export interface GridZone {
  readonly bounds: readonly [LL, LL]; // [southWest, northEast]
  readonly angleDeg: number;
  readonly blockM: readonly [number, number]; // block size (along, across) in metres
  readonly density: number; // 0–1 probability a block is drawn
  readonly seed: number;
}

export const GRID_ZONES: readonly GridZone[] = [
  { bounds: [[-6.235, 106.815], [-6.205, 106.835]], angleDeg: 8, blockM: [150, 110], density: 0.86, seed: 11 },   // Setiabudi/Kuningan
  { bounds: [[-6.205, 106.820], [-6.184, 106.845]], angleDeg: -28, blockM: [170, 130], density: 0.8, seed: 12 },  // Menteng/Cikini
  { bounds: [[-6.246, 106.846], [-6.222, 106.866]], angleDeg: 3, blockM: [120, 95], density: 0.9, seed: 13 },     // Tebet
  { bounds: [[-6.222, 106.840], [-6.205, 106.862]], angleDeg: 18, blockM: [110, 85], density: 0.9, seed: 14 },    // Manggarai/Bukit Duri
  { bounds: [[-6.300, 106.828], [-6.246, 106.862]], angleDeg: -6, blockM: [130, 100], density: 0.86, seed: 15 },  // Kalibata/Pejaten/Pasar Minggu
  { bounds: [[-6.280, 106.805], [-6.235, 106.828]], angleDeg: 14, blockM: [160, 120], density: 0.82, seed: 16 },  // Mampang/Kemang
  { bounds: [[-6.235, 106.790], [-6.205, 106.815]], angleDeg: -12, blockM: [190, 140], density: 0.7, seed: 17 },  // Senayan/Sudirman
  { bounds: [[-6.262, 106.790], [-6.235, 106.805]], angleDeg: 0, blockM: [150, 110], density: 0.85, seed: 18 },   // Blok M/Kebayoran
  { bounds: [[-6.205, 106.845], [-6.178, 106.880]], angleDeg: 6, blockM: [130, 100], density: 0.86, seed: 19 },   // Salemba/Matraman/Pramuka
  { bounds: [[-6.300, 106.862], [-6.205, 106.940]], angleDeg: -4, blockM: [140, 105], density: 0.84, seed: 20 },  // Jatinegara/Cawang/Cipinang
  { bounds: [[-6.320, 106.790], [-6.300, 106.940]], angleDeg: 10, blockM: [170, 130], density: 0.72, seed: 21 },  // South fringe
  { bounds: [[-6.184, 106.790], [-6.165, 106.845]], angleDeg: -3, blockM: [160, 120], density: 0.78, seed: 22 },  // Gambir/Tanah Abang
  { bounds: [[-6.300, 106.862], [-6.262, 106.905]], angleDeg: 22, blockM: [120, 90], density: 0.88, seed: 23 },   // Kramat Jati/Condet
];
