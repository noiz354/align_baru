"use client";

import type { OpsMapStall, SuitabilityFactor } from "@/features/hq/ops-map";
import { Icon, type IconName } from "@/shared/ui/hq-shell/Icon";
import { fmtRelative, fmtRupiah, fmtTime } from "../_map/format";
import { Badge, STATE_COLOR } from "./OpsMap";
import styles from "../ops-map.module.css";

export interface StallDrawerProps {
  readonly stall: OpsMapStall;
  readonly asOf: string;
  readonly onClose: () => void;
}

const WEATHER_ICON: Record<string, IconName> = { KERING: "sun", MENDUNG: "cloud", GERIMIS: "drizzle", HUJAN: "drizzle" };
const FACTOR_ICON: Record<SuitabilityFactor["key"], IconName> = { traffic: "footprints", weather: "drizzle", shelter: "umbrella", ground: "ground", sales: "receipt" };

function barColor(score: number): string {
  if (score >= 70) return "#059669";
  if (score >= 50) return "#f59e0b";
  return "#dc2626";
}

/** Trend arrow drawn as an icon so it does not depend on font glyph coverage. */
function TrendGlyph({ trend }: { trend: "UP" | "DOWN" | "FLAT" }) {
  if (trend === "FLAT") return <span className={styles.trendIcon}><Icon name="minus" size={11} strokeWidth={2.4} /></span>;
  return (
    <span className={styles.trendIcon} style={trend === "UP" ? { transform: "scaleY(-1)" } : undefined}>
      <Icon name="trend-down" size={11} strokeWidth={2.4} />
    </span>
  );
}

/** Caption that makes the field origin of a section explicit. */
function Source({ children }: { children: string }) {
  return (
    <span className={styles.cardMeta} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon name="smartphone" size={11} />
      {children}
    </span>
  );
}

export function StallDrawer({ stall, asOf, onClose }: StallDrawerProps) {
  const color = STATE_COLOR[stall.state];
  const pos = stall.position;
  const sourceLabel = pos.source === "OPERATOR_APP_GPS" ? "GPS aplikasi operator" : pos.source === "OPERATOR_APP_MANUAL" ? "Pin manual operator" : "Dicatat HQ";
  const flagTone = stall.state === "incident" ? "blocked" : stall.state === "offline" ? "neutral" : "waiting";

  return (
    <aside className={styles.drawer} aria-label={`Detail ${stall.code}`} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <div className={styles.drawerHead}>
        <span className={styles.drawerAccent} style={{ background: color }} />
        <div className={styles.drawerTitleRow}>
          <div className={styles.drawerTitle}>
            <span className={styles.stateDot} style={{ background: color }} />
            {stall.code}
          </div>
          <div className={styles.badges}>
            <Badge tone={stall.statusTone}>{stall.statusLabel}</Badge>
            {stall.attentionLabel ? <Badge tone={flagTone}>{stall.attentionLabel}</Badge> : null}
          </div>
          <div className={styles.drawerIcons}>
            <button type="button" className={styles.iconBtn} aria-label="Menu lainnya"><Icon name="more" size={16} /></button>
            <button type="button" className={styles.iconBtn} aria-label="Tutup panel" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
        </div>
        <div className={styles.drawerSub} title={`${stall.areaName}, Jakarta Selatan · ${pos.placeName}`}>
          {stall.areaName} · {pos.placeName}
        </div>

        <div className={styles.identityRow}>
          <div className={styles.avatar}>{stall.operator.initials}</div>
          <div>
            <div className={styles.operatorName}>{stall.operator.fullName}</div>
            <div className={styles.operatorMeta}>Operator · {stall.sales ? `shift sejak ${fmtTime(stall.sales.operatingSince)}` : "shift belum dibuka"}</div>
          </div>
          <div className={styles.positionBlock}>
            <span>Posisi terakhir</span>
            <strong>{fmtTime(pos.reportedAt)} · {fmtRelative(pos.reportedAt, asOf)}</strong>
            <span className={styles.positionSource}>
              <Icon name="smartphone" size={11} />
              {sourceLabel}{pos.accuracyM ? ` · ±${pos.accuracyM} m` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.drawerBody}>
        {/* ---- Sales snapshot (from operator POS entries) ---- */}
        <div className={styles.kpis} aria-label="Ringkasan penjualan">
          <div className={styles.kpi}><span className={styles.kpiLabel}>Penjualan saat ini</span><span className={styles.kpiValue}>{stall.sales ? fmtRupiah(stall.sales.grossMinor) : "—"}</span></div>
          <div className={styles.kpi}><span className={styles.kpiLabel}>Transaksi</span><span className={styles.kpiValue}>{stall.sales ? stall.sales.transactions : "—"}</span></div>
          <div className={styles.kpi}><span className={styles.kpiLabel}>Pengeluaran</span><span className={styles.kpiValue}>{stall.sales ? fmtRupiah(stall.sales.expensesMinor) : "—"}</span></div>
          <div className={styles.kpi}><span className={styles.kpiLabel}>Beroperasi sejak</span><span className={styles.kpiValue}>{stall.sales ? fmtTime(stall.sales.operatingSince) : "Belum mulai"}</span></div>
        </div>

        {/* ---- Location condition ---- */}
        <section className={styles.card} aria-labelledby="sec-kondisi">
          <div className={styles.cardHead}>
            <h3 id="sec-kondisi" className={styles.cardTitle}><Icon name="pin" size={14} style={{ color: "#0f766e" }} />Kondisi Lokasi</h3>
            <Source>{`Laporan operator · ${stall.site ? fmtTime(stall.site.reportedAt) : "—"}`}</Source>
          </div>
          <div className={styles.signals}>
            <div className={styles.signal}>
              <div className={styles.signalLabel}><Icon name="footprints" size={11} />Keramaian</div>
              {stall.traffic ? (
                <>
                  <div className={styles.signalValue}>{stall.traffic.label}</div>
                  <div className={styles.signalRow}><span>Sampling terakhir</span><strong>{fmtTime(stall.traffic.sampledAt)}</strong></div>
                  <div className={styles.signalRow}><span>Pejalan kaki</span><strong>{stall.traffic.countPer5Min} / 5 menit</strong></div>
                  <div className={styles.signalRow}><span>Tren</span><strong className={stall.traffic.trend === "DOWN" ? styles.trendDown : stall.traffic.trend === "UP" ? styles.trendUp : undefined}><TrendGlyph trend={stall.traffic.trend} />{stall.traffic.trendVsLabel.replace(/^[↑↓≈]\s*/, "")}</strong></div>
                  <div className={styles.signalFoot}><button type="button" className={styles.link}>Lihat Sampling</button></div>
                </>
              ) : (
                <div className={styles.empty}>Belum ada sampling hari ini.</div>
              )}
            </div>
            <div className={styles.signal}>
              <div className={styles.signalLabel}><Icon name="cloud" size={11} />Cuaca / Lokasi</div>
              {stall.site ? (
                <>
                  <div className={styles.signalValue}><Icon name={WEATHER_ICON[stall.site.weather] ?? "cloud"} size={16} style={{ color: "#2563eb" }} />{stall.site.weatherLabel}</div>
                  <div className={styles.signalRow}><span>Permukaan</span><strong>{stall.site.groundLabel}</strong></div>
                  <div className={styles.signalRow}><span>Peluang hujan</span><strong>{stall.site.rainProbabilityPct}%</strong></div>
                  <div className={styles.signalRow}><span>Kelayakan lokasi</span><Badge tone={stall.site.suitabilityTone}>{stall.site.suitabilityLabel}</Badge></div>
                  <div className={styles.signalNote}>{stall.site.reason}</div>
                  <div className={styles.signalFoot}><button type="button" className={styles.link}>Lihat Kondisi</button></div>
                </>
              ) : (
                <div className={styles.empty}>Belum ada laporan kondisi.</div>
              )}
            </div>
          </div>
        </section>

        {/* ---- Traffic video sampling (anonymous counting only) ---- */}
        <section className={styles.card} aria-labelledby="sec-sampling">
          <div className={styles.cardHead}>
            <h3 id="sec-sampling" className={styles.cardTitle}><Icon name="video" size={14} style={{ color: "#0f766e" }} />Sampling Keramaian</h3>
            <span className={styles.privacyPill}><Icon name="eye-off" size={12} />Analisis anonim</span>
          </div>
          {stall.sample ? (
            <>
              <div className={styles.sample}>
                <div className={styles.thumb}>
                  <img src={stall.sample.thumbnailUrl} alt={`Cuplikan anonim sekitar ${stall.code} pukul ${fmtTime(stall.sample.capturedAt)}`} />
                  <span className={styles.thumbTime}>{fmtTime(stall.sample.capturedAt)}</span>
                  <span className={styles.thumbPlay}><Icon name="play" size={10} strokeWidth={2.4} />00:{String(stall.sample.durationSec).padStart(2, "0")}</span>
                  <span className={styles.thumbCount}><Icon name="footprints" size={10} />{stall.sample.observations}</span>
                </div>
                <div className={styles.sampleMeta}>
                  <div>Rekaman terbaru <strong>{fmtTime(stall.sample.capturedAt)}</strong> · Durasi <strong>{stall.sample.durationSec} detik</strong></div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Sumber <strong>{stall.sample.sourceLabel}</strong><Icon name="smartphone" size={11} style={{ color: "#9ca3af" }} /></div>
                  <div><strong>{stall.sample.observations} observasi pejalan kaki</strong></div>
                  <div>Keramaian: <strong>{stall.sample.bandLabel}</strong></div>
                </div>
              </div>
              <div className={styles.sampleActions}>
                <button type="button" className={styles.btnSmPrimary}><Icon name="play" size={11} strokeWidth={2.4} />Lihat Rekaman</button>
                <button type="button" className={styles.btnSm}><Icon name="camera" size={12} />Ambil Sampel Baru</button>
              </div>
              <div className={styles.privacyNote}><Icon name="eye-off" size={12} style={{ color: "#0f766e", flexShrink: 0 }} />Video digunakan untuk estimasi keramaian, bukan identifikasi individu.</div>
            </>
          ) : (
            <div className={styles.empty}>Belum ada sampel video hari ini.</div>
          )}
        </section>

        {/* ---- Suitability indicators ---- */}
        <section className={styles.card} aria-labelledby="sec-kelayakan">
          <div className={styles.cardHead}>
            <h3 id="sec-kelayakan" className={styles.cardTitle}><Icon name="gauge" size={14} style={{ color: "#0f766e" }} />Kelayakan Mangkal</h3>
            {stall.suitability ? <Badge tone={stall.suitability.statusTone}>{stall.suitability.statusLabel}</Badge> : null}
          </div>
          {stall.suitability ? (
            <>
              <div className={styles.suitability}>
                <div className={styles.scoreBox}>
                  <div className={styles.scoreBig}>{stall.suitability.overall}<small>/ 100</small></div>
                  <div className={styles.scoreCaption}>Skor gabungan · {fmtTime(stall.suitability.computedAt)}</div>
                </div>
                <div className={styles.factors}>
                  {stall.suitability.factors.map((f) => (
                    <div key={f.key} className={styles.factor} title={f.sourceLabel}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name={FACTOR_ICON[f.key]} size={11} style={{ color: "#9ca3af" }} />{f.label}</span>
                      <div className={styles.bar}><div className={styles.barFill} style={{ width: `${f.score}%`, background: barColor(f.score) }} /></div>
                      <strong>{f.score}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.method}>
                <span>{stall.suitability.methodLabel}</span>
                <button type="button" className={styles.link}>Lihat Penilaian Lokasi →</button>
              </div>
            </>
          ) : (
            <div className={styles.empty}>Belum cukup data untuk indikator kelayakan.</div>
          )}
        </section>

        {/* ---- Security (neutral wording; operator-reported, HQ-reviewed) ---- */}
        <section className={styles.card} aria-labelledby="sec-keamanan">
          <div className={styles.cardHead}>
            <h3 id="sec-keamanan" className={styles.cardTitle}><Icon name="shield" size={14} style={{ color: "#0f766e" }} />Keamanan Lokasi</h3>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {stall.security && stall.security.openCount > 0 ? (
                <Badge tone="blocked">{stall.security.openCount} insiden terbuka</Badge>
              ) : (
                <Badge tone="ok">Tidak ada insiden terbuka</Badge>
              )}
              {stall.security?.latest ? <a href="/hq/incidents" className={styles.btnSm}>Lihat Insiden<Icon name="arrow-right" size={12} /></a> : null}
            </span>
          </div>
          {stall.security?.latest ? (
            <div className={styles.incident}>
              <div className={styles.incidentTitle}>
                <span>{stall.security.latest.categoryLabel}</span>
                <Badge tone={stall.security.latest.reviewStatusTone} icon="clock">{stall.security.latest.reviewStatusLabel}</Badge>
              </div>
              <div className={styles.incidentGrid}>
                <div>Dilaporkan <strong>{fmtTime(stall.security.latest.reportedAt)}</strong> oleh <strong>{stall.security.latest.reportedByLabel}</strong></div>
                <div>Bukti <strong>{stall.security.latest.evidence.photos} foto · {stall.security.latest.evidence.videos} video</strong></div>
                <div>Nominal tercatat <strong>{stall.security.latest.amountRecordedMinor != null ? fmtRupiah(stall.security.latest.amountRecordedMinor) : "—"}</strong></div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="smartphone" size={11} />Dikirim dari aplikasi operator</div>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>Tidak ada laporan keamanan untuk lokasi ini hari ini.</div>
          )}
        </section>
      </div>
    </aside>
  );
}
