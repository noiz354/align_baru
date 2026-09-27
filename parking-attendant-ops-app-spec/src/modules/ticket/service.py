"""
Ticket issuance: signed QR manifest payload + ESC/POS 58mm thermal receipt (TASK-304).

Per OFFLINE.md, the QR carries a signed mini-manifest (plate, check-in time, hash)
so a vehicle checked in at one offline post can be priced and paid at another
offline post without any network round-trip.
"""

import hashlib
import hmac
import json
from datetime import datetime
from typing import Optional

from src.core.domain import ParkingSession, PricingBreakdown

# ESC/POS control bytes.
ESC = b"\x1b"
GS = b"\x1d"
INIT = ESC + b"@"
CENTER = ESC + b"a\x01"
LEFT = ESC + b"a\x00"
BOLD_ON = ESC + b"E\x01"
BOLD_OFF = ESC + b"E\x00"
CUT = GS + b"V\x00"


class QrTicketBuilder:
    def __init__(self, device_secret: str = "demo-device-secret"):
        self._secret = device_secret.encode("utf-8")

    def build_payload(self, session: ParkingSession, clock=None) -> str:
        """Compact, signed manifest encoded into the QR matrix."""
        issued_at = (clock.now() if clock is not None else datetime.now()).isoformat()
        manifest = {
            "session_id": session.session_id,
            "plate": session.plate_number.display_format,
            "vehicle_type": session.vehicle_type.value,
            "slot_id": session.slot_id,
            "check_in": session.check_in_time.isoformat(),
            "issued_at": issued_at,
        }
        body = json.dumps(manifest, separators=(",", ":"), sort_keys=True)
        signature = hmac.new(self._secret, body.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
        manifest["sig"] = signature
        return json.dumps(manifest, separators=(",", ":"), sort_keys=True)

    @staticmethod
    def verify_payload(payload: str, device_secret: str = "demo-device-secret") -> dict:
        data = json.loads(payload)
        sig = data.pop("sig", None)
        body = json.dumps(data, separators=(",", ":"), sort_keys=True)
        expected = hmac.new(
            device_secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256
        ).hexdigest()[:16]
        if not hmac.compare_digest(expected, sig or ""):
            raise ValueError("Tanda tangan QR tidak valid (manifest rusak / dipalsukan).")
        return data


class EscPosReceiptBuilder:
    """Builds ESC/POS byte commands for a 58mm thermal printer."""

    WIDTH = 32  # characters for 58mm paper at default font

    @staticmethod
    def _wrap(text: str, width: int = WIDTH) -> str:
        lines = []
        for line in text.split("\n"):
            while len(line) > width:
                lines.append(line[:width])
                line = line[width:]
            lines.append(line)
        return "\n".join(lines)

    @classmethod
    def build_receipt(
        cls,
        session: ParkingSession,
        pricing: Optional[PricingBreakdown],
        attendant_name: str = "",
        qr_payload: str = "",
    ) -> bytes:
        out = bytearray()
        out += INIT
        out += CENTER + BOLD_ON
        out += b"KANTUNG PARKIR PASAR BARU\n"
        out += b"     OPERATOR RESMI\n" + BOLD_OFF
        out += b"=" * cls.WIDTH + b"\n"
        out += LEFT
        check_in = session.check_in_time.strftime("%d/%m/%Y %H:%M")
        lines = [
            f"TIKET  : {session.session_id[-8:].upper()}",
            f"PLAT   : {session.plate_number.display_format}",
            f"TIPE   : {session.vehicle_type.value}",
            f"WARNA  : {session.color or '-'}",
            f"SLOT   : {session.slot_id}",
            f"MASUK  : {check_in}",
            f"PETUGAS: {attendant_name or session.check_in_attendant_id}",
        ]
        out += cls._wrap("\n".join(lines)).encode("utf-8") + b"\n"
        out += b"-" * cls.WIDTH + b"\n"
        if pricing:
            fee = f"Rp {int(pricing.total_fee):,}".replace(",", ".")
            out += BOLD_ON + f"TAGIHAN: {fee}\n".encode("utf-8") + BOLD_OFF
            if pricing.is_grace_period:
                out += b"(Grace period - gratis)\n"
            if pricing.lost_ticket_fee:
                out += b"(Termasuk denda tiket hilang)\n"
        out += b"-" * cls.WIDTH + b"\n"
        out += cls._wrap(
            "Simpan tiket ini untuk checkout.\n"
            "Barang berharga harap dibawa.\n"
            "Observasi masuk bukan perjanjian penitipan barang."
        ).encode("utf-8") + b"\n"
        if qr_payload:
            out += CENTER + b"[ QR MANIFEST ]\n"
            out += cls._wrap(qr_payload).encode("utf-8") + b"\n" + LEFT
        out += b"=" * cls.WIDTH + b"\n\n\n"
        out += CUT
        return bytes(out)
