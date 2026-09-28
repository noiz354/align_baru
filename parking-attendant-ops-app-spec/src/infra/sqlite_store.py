"""
Local-first SQLite persistence (ADR-001 / TASK-102 / TASK-103).

Implements the domain ports ``IParkingRepository`` and ``IShiftRepository`` and
additionally persists photos, incidents, zones and an outbox queue. A tiny
versioned migration runner plus a transactional context manager satisfy
TASK-103.
"""

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.core.domain import (
    IAuditLogPort,
    IParkingRepository,
    IShiftRepository,
    ObservedItem,
    ParkingSession,
    ParkingSlot,
    PhotoEvidence,
    PricingBreakdown,
    SessionState,
    SlotStatus,
    VehicleType,
    Zone,
)


# ---------------------------------------------------------------------------
# Schema migrations (idempotent, versioned)
# ---------------------------------------------------------------------------
MIGRATIONS: List[tuple] = [
    (
        1,
        "base_schema",
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS zones (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            facility_id TEXT NOT NULL DEFAULT '',
            position_x REAL NOT NULL DEFAULT 0.0,
            position_y REAL NOT NULL DEFAULT 0.0
        );
        CREATE TABLE IF NOT EXISTS slots (
            id TEXT PRIMARY KEY,
            slot_code TEXT NOT NULL,
            zone_id TEXT NOT NULL,
            allowed_type TEXT NOT NULL,
            status TEXT NOT NULL,
            current_session_id TEXT,
            position_x REAL NOT NULL DEFAULT 0.0,
            position_y REAL NOT NULL DEFAULT 0.0
        );
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            plate_raw TEXT NOT NULL,
            plate_canonical TEXT NOT NULL,
            plate_display TEXT NOT NULL,
            vehicle_type TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '',
            slot_id TEXT NOT NULL,
            check_in_time TEXT NOT NULL,
            check_in_attendant_id TEXT NOT NULL,
            shift_id TEXT NOT NULL,
            state TEXT NOT NULL,
            initial_condition_notes TEXT NOT NULL DEFAULT '',
            observed_items_json TEXT NOT NULL DEFAULT '[]',
            photos_json TEXT NOT NULL DEFAULT '[]',
            check_out_time TEXT,
            check_out_attendant_id TEXT,
            pricing_json TEXT,
            payment_status TEXT NOT NULL DEFAULT 'UNPAID',
            has_active_incident INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS photos (
            evidence_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            perspective TEXT NOT NULL,
            file_path TEXT NOT NULL,
            hash_sha256 TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            attendant_id TEXT NOT NULL,
            is_retained INTEGER NOT NULL DEFAULT 1,
            geo_lat REAL,
            geo_lon REAL,
            geo_acc REAL,
            device_id TEXT
        );
        CREATE TABLE IF NOT EXISTS shifts (
            shift_id TEXT PRIMARY KEY,
            attendant_id TEXT NOT NULL,
            supervisor_id TEXT,
            zone_id TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            cash_float_start REAL NOT NULL DEFAULT 0.0,
            cash_collected_system REAL NOT NULL DEFAULT 0.0,
            qris_collected_system REAL NOT NULL DEFAULT 0.0,
            actual_cash_counted REAL,
            active_vehicles_handed_over INTEGER,
            cash_variance REAL,
            status TEXT NOT NULL DEFAULT 'OPEN'
        );
        CREATE TABLE IF NOT EXISTS incidents (
            incident_id TEXT PRIMARY KEY,
            session_id TEXT,
            category TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'MEDIUM',
            description TEXT NOT NULL DEFAULT '',
            attendant_id TEXT NOT NULL,
            supervisor_id TEXT,
            reported_at TEXT NOT NULL,
            is_resolved INTEGER NOT NULL DEFAULT 0,
            police_report_no TEXT,
            freeze_retention INTEGER NOT NULL DEFAULT 0,
            photo_evidence_ids TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS outbox_events (
            event_id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_plate ON sessions(plate_canonical);
        CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
        CREATE INDEX IF NOT EXISTS idx_photos_session ON photos(session_id);
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
        """,
    ),
    (
        2,
        "checkout_idempotency_payments_receipts",
        """
        ALTER TABLE sessions ADD COLUMN checkout_payment_method TEXT;
        ALTER TABLE sessions ADD COLUMN payment_id TEXT;
        ALTER TABLE sessions ADD COLUMN receipt_id TEXT;
        CREATE TABLE checkout_payments (
            payment_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            method TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES sessions(session_id)
        );
        CREATE TABLE receipts (
            receipt_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            payment_id TEXT NOT NULL UNIQUE,
            payload_json TEXT NOT NULL,
            issued_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES sessions(session_id),
            FOREIGN KEY(payment_id) REFERENCES checkout_payments(payment_id)
        );
        CREATE INDEX idx_checkout_payments_session ON checkout_payments(session_id);
        CREATE INDEX idx_receipts_session ON receipts(session_id);
        """,
    ),
]


def _applied_versions(conn: sqlite3.Connection) -> set:
    cur = conn.execute("SELECT version FROM schema_migrations")
    return {row[0] for row in cur.fetchall()}


def run_migrations(conn: sqlite3.Connection) -> None:
    """TASK-103: idempotent versioned migration runner."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        "version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
    )
    applied = _applied_versions(conn)
    for version, name, sql in MIGRATIONS:
        if version in applied:
            continue
        conn.executescript(sql)
        conn.execute(
            "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
            (version, datetime.now().astimezone().isoformat()),
        )
        conn.commit()


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------
def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _from_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=__import__("datetime").timezone.utc)


def _parse_observed_items(raw: str) -> List[ObservedItem]:
    items = []
    for d in json.loads(raw or "[]"):
        items.append(
            ObservedItem(
                item_type=d["item_type"],
                count=int(d.get("count", 1)),
                location_on_vehicle=d.get("location_on_vehicle", ""),
                notes=d.get("notes"),
            )
        )
    return items


def _serialize_observed_items(items: List[ObservedItem]) -> str:
    return json.dumps(
        [
            {
                "item_type": i.item_type,
                "count": i.count,
                "location_on_vehicle": i.location_on_vehicle,
                "notes": i.notes,
            }
            for i in items
        ]
    )


def _serialize_pricing(p: Optional[PricingBreakdown]) -> Optional[str]:
    if not p:
        return None
    return json.dumps(
        {
            "duration_minutes": p.duration_minutes,
            "billable_hours": p.billable_hours,
            "base_fee": p.base_fee,
            "lost_ticket_fee": p.lost_ticket_fee,
            "total_fee": p.total_fee,
            "is_grace_period": p.is_grace_period,
            "notes": p.notes,
        }
    )


def _parse_pricing(raw: Optional[str]) -> Optional[PricingBreakdown]:
    if not raw:
        return None
    d = json.loads(raw)
    return PricingBreakdown(
        duration_minutes=d["duration_minutes"],
        billable_hours=d["billable_hours"],
        base_fee=d["base_fee"],
        lost_ticket_fee=d["lost_ticket_fee"],
        total_fee=d["total_fee"],
        is_grace_period=d.get("is_grace_period", False),
        notes=d.get("notes"),
    )


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------
class SqliteParkingStore:
    """Concrete local-first store implementing the domain repository ports."""

    def __init__(self, db_path: str = ":memory:", apply_migrations: bool = True) -> None:
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        if apply_migrations:
            run_migrations(self._conn)

    # -- TASK-103: transactional wrapper ----------------------------------
    @contextmanager
    def transaction(self, immediate: bool = False):
        """Composable transactions; checkout can serialize read-modify-write."""
        if self._conn.in_transaction:
            name = f"sp_{uuid.uuid4().hex}"
            self._conn.execute(f"SAVEPOINT {name}")
            try:
                yield self._conn
                self._conn.execute(f"RELEASE SAVEPOINT {name}")
            except Exception:
                self._conn.execute(f"ROLLBACK TO SAVEPOINT {name}")
                self._conn.execute(f"RELEASE SAVEPOINT {name}")
                raise
            return
        self._conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")
        try:
            yield self._conn
            self._conn.execute("COMMIT")
        except Exception:
            self._conn.execute("ROLLBACK")
            raise

    def close(self) -> None:
        self._conn.close()

    # -- Zones -------------------------------------------------------------
    def save_zone(self, zone: Zone) -> None:
        with self.transaction():
            self._conn.execute(
                "INSERT OR REPLACE INTO zones "
                "(id, name, facility_id, position_x, position_y) "
                "VALUES (?, ?, ?, ?, ?)",
                (zone.zone_id, zone.name, zone.facility_id, zone.position_x, zone.position_y),
            )

    def get_zone(self, zone_id: str) -> Optional[Zone]:
        row = self._conn.execute("SELECT * FROM zones WHERE id = ?", (zone_id,)).fetchone()
        if not row:
            return None
        return Zone(
            zone_id=row["id"],
            name=row["name"],
            facility_id=row["facility_id"],
            position_x=row["position_x"],
            position_y=row["position_y"],
        )

    def list_zones(self) -> List[Zone]:
        return [
            Zone(
                zone_id=r["id"],
                name=r["name"],
                facility_id=r["facility_id"],
                position_x=r["position_x"],
                position_y=r["position_y"],
            )
            for r in self._conn.execute("SELECT * FROM zones").fetchall()
        ]

    # -- Slots (IParkingRepository) ---------------------------------------
    def get_slot(self, slot_id: str) -> Optional[ParkingSlot]:
        row = self._conn.execute("SELECT * FROM slots WHERE id = ?", (slot_id,)).fetchone()
        if not row:
            return None
        return self._row_to_slot(row)

    def save_slot(self, slot: ParkingSlot) -> None:
        with self.transaction():
            self._conn.execute(
                "INSERT OR REPLACE INTO slots "
                "(id, slot_code, zone_id, allowed_type, status, current_session_id, "
                "position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    slot.slot_id,
                    slot.slot_code,
                    slot.zone_id,
                    slot.allowed_type.value,
                    slot.status.value,
                    slot.current_session_id,
                    slot.position_x,
                    slot.position_y,
                ),
            )

    def list_empty_slots(self, zone_id: str, vehicle_type: VehicleType) -> List[ParkingSlot]:
        rows = self._conn.execute(
            "SELECT * FROM slots WHERE zone_id = ? AND status = ? AND allowed_type = ? "
            "ORDER BY position_x, position_y",
            (zone_id, SlotStatus.EMPTY.value, vehicle_type.value),
        ).fetchall()
        return [self._row_to_slot(r) for r in rows]

    def list_all_slots(self, zone_id: Optional[str] = None) -> List[ParkingSlot]:
        if zone_id:
            rows = self._conn.execute(
                "SELECT * FROM slots WHERE zone_id = ?", (zone_id,)
            ).fetchall()
        else:
            rows = self._conn.execute("SELECT * FROM slots").fetchall()
        return [self._row_to_slot(r) for r in rows]

    @staticmethod
    def _row_to_slot(row: sqlite3.Row) -> ParkingSlot:
        return ParkingSlot(
            slot_id=row["id"],
            slot_code=row["slot_code"],
            zone_id=row["zone_id"],
            allowed_type=VehicleType(row["allowed_type"]),
            status=SlotStatus(row["status"]),
            current_session_id=row["current_session_id"],
            position_x=row["position_x"],
            position_y=row["position_y"],
        )

    # -- Sessions (IParkingRepository) ------------------------------------
    def save_session(self, session: ParkingSession) -> None:
        with self.transaction():
            self._conn.execute(
                "INSERT OR REPLACE INTO sessions "
                "(session_id, plate_raw, plate_canonical, plate_display, vehicle_type, "
                "color, slot_id, check_in_time, check_in_attendant_id, shift_id, state, "
                "initial_condition_notes, observed_items_json, photos_json, "
                "check_out_time, check_out_attendant_id, pricing_json, payment_status, "
                "has_active_incident, checkout_payment_method, payment_id, receipt_id) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    session.session_id,
                    session.plate_number.raw_value,
                    session.plate_number.canonical,
                    session.plate_number.display_format,
                    session.vehicle_type.value,
                    session.color,
                    session.slot_id,
                    _iso(session.check_in_time),
                    session.check_in_attendant_id,
                    session.shift_id,
                    session.state.value,
                    session.initial_condition_notes,
                    _serialize_observed_items(session.observed_items),
                    json.dumps([p.evidence_id for p in session.photos]),
                    _iso(session.check_out_time),
                    session.check_out_attendant_id,
                    _serialize_pricing(session.pricing),
                    session.payment_status.value,
                    1 if session.has_active_incident else 0,
                    session.checkout_payment_method,
                    session.payment_id,
                    session.receipt_id,
                ),
            )
            # Persist attached photos so retention/forensics can find them.
            for photo in session.photos:
                self._save_photo_row(photo)

    def record_checkout_payment_receipt(
        self, session_id: str, method: str, amount: float, status: str, issued_at: datetime
    ) -> tuple[str, str]:
        """Create one durable logical payment and receipt per finalized stay.

        Caller holds the outer checkout transaction (BEGIN IMMEDIATE); unique
        session constraints are a durable dedupe backstop.
        """
        row = self._conn.execute(
            "SELECT payment_id, method, amount FROM checkout_payments WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if row:
            if row["method"] != method or float(row["amount"]) != float(amount):
                raise ValueError("Checkout already has a different payment")
            receipt = self._conn.execute(
                "SELECT receipt_id FROM receipts WHERE session_id = ?", (session_id,)
            ).fetchone()
            if not receipt:
                raise RuntimeError("Payment exists without its receipt")
            return str(row["payment_id"]), str(receipt["receipt_id"])

        payment_id = "pay_" + uuid.uuid4().hex
        receipt_id = "rcpt_" + uuid.uuid4().hex
        payload = {
            "receipt_id": receipt_id, "payment_id": payment_id,
            "session_id": session_id, "method": method,
            "amount": float(amount), "status": status,
            "issued_at": _iso(issued_at),
        }
        self._conn.execute(
            "INSERT INTO checkout_payments(payment_id, session_id, method, amount, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (payment_id, session_id, method, float(amount), status, _iso(issued_at)),
        )
        self._conn.execute(
            "INSERT INTO receipts(receipt_id, session_id, payment_id, payload_json, issued_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (receipt_id, session_id, payment_id, json.dumps(payload, sort_keys=True), _iso(issued_at)),
        )
        return payment_id, receipt_id

    def list_checkout_payments(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if session_id:
            rows = self._conn.execute("SELECT * FROM checkout_payments WHERE session_id = ?", (session_id,)).fetchall()
        else:
            rows = self._conn.execute("SELECT * FROM checkout_payments ORDER BY created_at").fetchall()
        return [dict(row) for row in rows]

    def list_receipts(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if session_id:
            rows = self._conn.execute("SELECT * FROM receipts WHERE session_id = ?", (session_id,)).fetchall()
        else:
            rows = self._conn.execute("SELECT * FROM receipts ORDER BY issued_at").fetchall()
        return [dict(row) for row in rows]

    def get_session(self, session_id: str) -> Optional[ParkingSession]:
        row = self._conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_session(row)

    def find_active_session_by_plate(self, canonical_plate: str) -> Optional[ParkingSession]:
        row = self._conn.execute(
            "SELECT * FROM sessions WHERE plate_canonical = ? AND state = ? "
            "ORDER BY check_in_time DESC LIMIT 1",
            (canonical_plate, SessionState.ACTIVE.value),
        ).fetchone()
        return self._row_to_session(row) if row else None

    def list_active_sessions(self, zone_id: Optional[str] = None) -> List[ParkingSession]:
        if zone_id:
            rows = self._conn.execute(
                "SELECT * FROM sessions WHERE state = ? AND slot_id IN "
                "(SELECT id FROM slots WHERE zone_id = ?)",
                (SessionState.ACTIVE.value, zone_id),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM sessions WHERE state = ?", (SessionState.ACTIVE.value,)
            ).fetchall()
        return [self._row_to_session(r) for r in rows]

    def list_sessions_by_zone(self, zone_id: str) -> List[ParkingSession]:
        """All sessions whose slot is in the given zone (any state)."""
        rows = self._conn.execute(
            "SELECT * FROM sessions WHERE slot_id IN "
            "(SELECT id FROM slots WHERE zone_id = ?)",
            (zone_id,),
        ).fetchall()
        return [self._row_to_session(r) for r in rows]

    def _row_to_session(self, row: sqlite3.Row) -> ParkingSession:
        return ParkingSession(
            session_id=row["session_id"],
            plate_number=__import__("src.core.domain", fromlist=["PlateNumber"]).PlateNumber(
                raw_value=row["plate_raw"],
                canonical=row["plate_canonical"],
                display_format=row["plate_display"],
            ),
            vehicle_type=VehicleType(row["vehicle_type"]),
            color=row["color"],
            slot_id=row["slot_id"],
            check_in_time=_from_iso(row["check_in_time"]),
            check_in_attendant_id=row["check_in_attendant_id"],
            shift_id=row["shift_id"],
            state=SessionState(row["state"]),
            initial_condition_notes=row["initial_condition_notes"],
            observed_items=_parse_observed_items(row["observed_items_json"]),
            photos=self.list_photos(row["session_id"]),
            check_out_time=_from_iso(row["check_out_time"]),
            check_out_attendant_id=row["check_out_attendant_id"],
            pricing=_parse_pricing(row["pricing_json"]),
            payment_status=__import__(
                "src.core.domain", fromlist=["PaymentStatus"]
            ).PaymentStatus(row["payment_status"]),
            has_active_incident=bool(row["has_active_incident"]),
            checkout_payment_method=row["checkout_payment_method"],
            payment_id=row["payment_id"],
            receipt_id=row["receipt_id"],
        )

    # -- Photos ------------------------------------------------------------
    def _save_photo_row(self, photo: PhotoEvidence) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO photos "
            "(evidence_id, session_id, perspective, file_path, hash_sha256, captured_at, "
            "attendant_id, is_retained, geo_lat, geo_lon, geo_acc, device_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                photo.evidence_id,
                photo.session_id,
                photo.perspective,
                photo.file_path,
                photo.hash_sha256,
                _iso(photo.captured_at),
                photo.attendant_id,
                1 if photo.is_retained else 0,
                getattr(photo, "geo_lat", None),
                getattr(photo, "geo_lon", None),
                getattr(photo, "geo_acc", None),
                getattr(photo, "device_id", None),
            ),
        )

    def save_photo(self, photo: PhotoEvidence) -> None:
        with self.transaction():
            self._save_photo_row(photo)

    def get_photo(self, evidence_id: str) -> Optional[PhotoEvidence]:
        row = self._conn.execute(
            "SELECT * FROM photos WHERE evidence_id = ?", (evidence_id,)
        ).fetchone()
        return self._row_to_photo(row) if row else None

    def list_photos(self, session_id: str) -> List[PhotoEvidence]:
        rows = self._conn.execute(
            "SELECT * FROM photos WHERE session_id = ? ORDER BY captured_at",
            (session_id,),
        ).fetchall()
        return [self._row_to_photo(r) for r in rows]

    def list_retained_photos_before(self, cutoff: datetime) -> List[PhotoEvidence]:
        rows = self._conn.execute(
            "SELECT * FROM photos WHERE is_retained = 1 AND captured_at < ?",
            (_iso(cutoff),),
        ).fetchall()
        return [self._row_to_photo(r) for r in rows]

    def mark_photo_purged(self, evidence_id: str) -> None:
        with self.transaction():
            self._conn.execute(
                "UPDATE photos SET is_retained = 0 WHERE evidence_id = ?", (evidence_id,)
            )

    @staticmethod
    def _row_to_photo(row: sqlite3.Row) -> PhotoEvidence:
        return PhotoEvidence(
            evidence_id=row["evidence_id"],
            session_id=row["session_id"],
            perspective=row["perspective"],
            file_path=row["file_path"],
            hash_sha256=row["hash_sha256"],
            captured_at=_from_iso(row["captured_at"]),
            attendant_id=row["attendant_id"],
            is_retained=bool(row["is_retained"]),
        )

    # -- Shifts (IShiftRepository) ----------------------------------------
    def save_shift(self, shift: Any) -> None:
        with self.transaction():
            self._conn.execute(
                "INSERT OR REPLACE INTO shifts "
                "(shift_id, attendant_id, supervisor_id, zone_id, start_time, end_time, "
                "cash_float_start, cash_collected_system, qris_collected_system, "
                "actual_cash_counted, active_vehicles_handed_over, cash_variance, status) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    shift.shift_id,
                    shift.attendant_id,
                    shift.supervisor_id,
                    shift.zone_id,
                    _iso(shift.start_time),
                    _iso(shift.end_time),
                    shift.cash_float_start,
                    shift.cash_collected_system,
                    shift.qris_collected_system,
                    shift.actual_cash_counted,
                    shift.active_vehicles_handed_over,
                    shift.cash_variance,
                    shift.status.value,
                ),
            )

    def get_shift(self, shift_id: str) -> Optional[Any]:
        row = self._conn.execute(
            "SELECT * FROM shifts WHERE shift_id = ?", (shift_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_shift(row)

    def list_open_shifts(self) -> List[Any]:
        rows = self._conn.execute(
            "SELECT * FROM shifts WHERE status = ?", ("OPEN",)
        ).fetchall()
        return [self._row_to_shift(r) for r in rows]

    def _row_to_shift(self, row: sqlite3.Row) -> Any:
        ShiftRecord = __import__(
            "src.modules.shift.service", fromlist=["ShiftRecord"]
        ).ShiftRecord
        ShiftStatus = __import__(
            "src.core.domain", fromlist=["ShiftStatus"]
        ).ShiftStatus
        shift = ShiftRecord(
            shift_id=row["shift_id"],
            attendant_id=row["attendant_id"],
            zone_id=row["zone_id"],
            cash_float_start=row["cash_float_start"],
            supervisor_id=row["supervisor_id"],
            start_time=_from_iso(row["start_time"]),
            end_time=_from_iso(row["end_time"]),
            status=ShiftStatus(row["status"]),
        )
        shift.cash_collected_system = row["cash_collected_system"]
        shift.qris_collected_system = row["qris_collected_system"]
        shift.actual_cash_counted = row["actual_cash_counted"]
        shift.active_vehicles_handed_over = row["active_vehicles_handed_over"]
        shift.cash_variance = row["cash_variance"]
        return shift

    # -- Incidents ---------------------------------------------------------
    def save_incident(self, incident: Any) -> None:
        with self.transaction():
            self._conn.execute(
                "INSERT OR REPLACE INTO incidents "
                "(incident_id, session_id, category, severity, description, attendant_id, "
                "supervisor_id, reported_at, is_resolved, police_report_no, "
                "freeze_retention, photo_evidence_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    incident.incident_id,
                    incident.session_id,
                    incident.category.value if hasattr(incident.category, "value") else incident.category,
                    getattr(incident, "severity", "MEDIUM"),
                    incident.description,
                    incident.attendant_id,
                    getattr(incident, "supervisor_id", None),
                    _iso(incident.reported_at),
                    1 if getattr(incident, "is_resolved", False) else 0,
                    incident.police_report_no,
                    1 if getattr(incident, "freeze_retention", False) else 0,
                    json.dumps(incident.photo_evidence_ids),
                ),
            )

    def get_incident(self, incident_id: str) -> Optional[Any]:
        row = self._conn.execute(
            "SELECT * FROM incidents WHERE incident_id = ?", (incident_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_incident(row)

    def list_incidents(self, session_id: Optional[str] = None) -> List[Any]:
        if session_id:
            rows = self._conn.execute(
                "SELECT * FROM incidents WHERE session_id = ?", (session_id,)
            ).fetchall()
        else:
            rows = self._conn.execute("SELECT * FROM incidents").fetchall()
        return [self._row_to_incident(r) for r in rows]

    def _row_to_incident(self, row: sqlite3.Row) -> Any:
        IncidentReport = __import__(
            "src.modules.incident.service", fromlist=["IncidentReport"]
        ).IncidentReport
        IncidentCategory = __import__(
            "src.core.domain", fromlist=["IncidentCategory"]
        ).IncidentCategory
        return IncidentReport(
            incident_id=row["incident_id"],
            session_id=row["session_id"],
            category=IncidentCategory(row["category"]),
            description=row["description"],
            attendant_id=row["attendant_id"],
            reported_at=_from_iso(row["reported_at"]),
            photo_evidence_ids=json.loads(row["photo_evidence_ids"]),
            police_report_no=row["police_report_no"],
            is_resolved=bool(row["is_resolved"]),
        )

    # -- Outbox (OFFLINE.md) ----------------------------------------------
    def enqueue_outbox(self, event_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        with self.transaction():
            self._conn.execute(
                "INSERT OR REPLACE INTO outbox_events "
                "(event_id, event_type, payload, status, created_at) VALUES (?, ?, ?, ?, ?)",
                (
                    event_id,
                    event_type,
                    json.dumps(payload, default=str),
                    "PENDING",
                    datetime.now().astimezone().isoformat(),
                ),
            )

    def pending_outbox(self, limit: int = 50) -> List[Dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM outbox_events WHERE status = 'PENDING' LIMIT ?", (limit,)
        ).fetchall()
        return [
            {
                "event_id": r["event_id"],
                "event_type": r["event_type"],
                "payload": json.loads(r["payload"]),
            }
            for r in rows
        ]

    def acknowledge_outbox(self, event_ids: List[str]) -> None:
        with self.transaction():
            for eid in event_ids:
                self._conn.execute(
                    "UPDATE outbox_events SET status = 'ACKNOWLEDGED' WHERE event_id = ?",
                    (eid,),
                )
