/**
 * Operations map read model (HQ → "Operasional › Peta Live").
 *
 * Every position on this surface is an explicit, operator-initiated LocationReport
 * bound to an open shift (ADR-0007, FR-LOCATION-001/004/005). There is no background
 * tracking: a stall whose last report is old simply becomes "offline / posisi lama".
 *
 * Traffic sampling is an anonymous count estimate from a short operator-captured clip.
 * The read model never carries identities, faces, or demographic attributes (PRIVACY.md).
 */

export type StallMarkerState = "normal" | "attention" | "incident" | "offline";

export type TrafficBand = "RAMAI" | "SEDANG" | "SEPI";

export type Tone = "ok" | "waiting" | "attention" | "blocked" | "neutral";

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface ReportedPosition extends GeoPoint {
  /** When the operator sent the report (ISO-8601 with offset). */
  readonly reportedAt: string;
  readonly source: "OPERATOR_APP_GPS" | "OPERATOR_APP_MANUAL" | "HQ_ON_BEHALF";
  readonly reason: "SHIFT_START" | "MOVE" | "PERIODIC_CONFIRM" | "HQ_REQUEST";
  readonly accuracyM?: number;
  readonly placeName: string;
}

export interface StallSales {
  readonly grossMinor: number;
  readonly transactions: number;
  readonly expensesMinor: number;
  readonly operatingSince: string;
  readonly lastSaleAt?: string;
}

export interface TrafficSignal {
  readonly band: TrafficBand;
  readonly label: string;
  readonly sampledAt: string;
  readonly countPer5Min: number;
  readonly trend: "UP" | "DOWN" | "FLAT";
  readonly trendVsLabel: string;
}

export interface SiteSignal {
  readonly weather: "KERING" | "MENDUNG" | "GERIMIS" | "HUJAN";
  readonly weatherLabel: string;
  readonly ground: "KERING" | "BASAH" | "TERGENANG";
  readonly groundLabel: string;
  readonly rainProbabilityPct: number;
  readonly suitabilityLabel: string;
  readonly suitabilityTone: Tone;
  readonly reason: string;
  readonly reportedAt: string;
}

export interface TrafficSample {
  readonly sampleId: string;
  readonly capturedAt: string;
  readonly durationSec: number;
  readonly sourceLabel: string;
  readonly observations: number;
  readonly band: TrafficBand;
  readonly bandLabel: string;
  /** Anonymised still frame (people rendered as silhouettes / blurred). */
  readonly thumbnailUrl: string;
  readonly anonymised: true;
}

export interface SuitabilityFactor {
  readonly key: "traffic" | "weather" | "shelter" | "ground" | "sales";
  readonly label: string;
  readonly score: number;
  readonly sourceLabel: string;
}

export interface SuitabilityScore {
  readonly overall: number;
  readonly statusLabel: string;
  readonly statusTone: Tone;
  readonly factors: readonly SuitabilityFactor[];
  readonly computedAt: string;
  readonly methodLabel: string;
}

export interface SecurityIncidentSummary {
  readonly incidentId: string;
  readonly categoryLabel: string;
  readonly reportedAt: string;
  readonly reportedByLabel: string;
  readonly evidence: { readonly photos: number; readonly videos: number };
  readonly amountRecordedMinor?: number;
  readonly reviewStatusLabel: string;
  readonly reviewStatusTone: Tone;
}

export interface SecuritySignal {
  readonly openCount: number;
  readonly latest?: SecurityIncidentSummary;
}

export interface OpsMapStall {
  readonly stallId: string;
  readonly code: string;
  readonly areaName: string;
  readonly operator: { readonly shortName: string; readonly fullName: string; readonly initials: string };
  readonly state: StallMarkerState;
  readonly statusLabel: string;
  readonly statusTone: Tone;
  readonly attentionLabel?: string;
  readonly attentionReason?: string;
  readonly position: ReportedPosition;
  readonly sales?: StallSales;
  readonly traffic?: TrafficSignal;
  readonly site?: SiteSignal;
  readonly sample?: TrafficSample;
  readonly suitability?: SuitabilityScore;
  readonly security?: SecuritySignal;
  readonly openIncidents: number;
}

export type OpsMapEventKind =
  | "TRAFFIC_SAMPLE" | "WET_AREA" | "SECURITY_INCIDENT" | "RELOCATION" | "OPERATOR_UPDATE";

export interface OpsMapEvent extends GeoPoint {
  readonly eventId: string;
  readonly kind: OpsMapEventKind;
  readonly at: string;
  readonly label: string;
  readonly stallCode?: string;
  readonly from?: GeoPoint;
}

export interface OpsMapActivity {
  readonly activityId: string;
  readonly at: string;
  readonly stallCode: string;
  readonly kind: "POSITION" | "SALE" | "SAMPLE" | "INCIDENT" | "MOVE";
  readonly text: string;
}

export interface WeatherZone extends GeoPoint {
  readonly zoneId: string;
  readonly radiusM: number;
  readonly label: string;
  readonly at: string;
}

export interface OpsMapReadModel {
  readonly businessDay: string;
  /** Snapshot moment; relative labels on the page are computed against this. */
  readonly asOf: string;
  readonly computedAt: string;
  readonly areaLabel: string;
  readonly stalls: readonly OpsMapStall[];
  readonly events: readonly OpsMapEvent[];
  readonly activity: readonly OpsMapActivity[];
  readonly weatherZones: readonly WeatherZone[];
}
