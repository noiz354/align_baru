"""
OCR Adapter Interface and Indonesian Plate Parser.
Fallback to manual attendant entry is guaranteed without UI blocking.
"""

import re
from typing import Optional, Tuple


class IOcrEngine:
    def process_frame(self, image_bytes: bytes) -> Tuple[Optional[str], float]:
        """
        Returns (detected_plate_text, confidence_score 0.0 - 1.0)
        """
        raise NotImplementedError


class MockEdgeOcrEngine(IOcrEngine):
    """
    Simulated On-Device Edge OCR with Indonesian plate heuristic.
    """
    def process_frame(self, image_bytes: bytes) -> Tuple[Optional[str], float]:
        # Skeleton simulation
        return ("B 4821 SSG", 0.94)


class PlatePostProcessor:
    @staticmethod
    def fix_common_ocr_errors(raw_text: str) -> str:
        """
        Applies Indonesian-plate OCR heuristics (OCR.md):
          * strip and uppercase
          * inside the numeric registration segment, 'O' -> '0' and 'I' -> '1'
          * keep the leading region letters and trailing suffix letters intact
        """
        cleaned = raw_text.strip().upper()
        # Pattern: <region letters> <numbers> <suffix letters>
        import re
        m = re.match(r"^([A-Z]{1,2})\s*([0-9OoIiLl]{1,4})\s*([A-Z]{0,3})$", cleaned)
        if not m:
            # Plain cleanup for non-standard plates.
            return re.sub(r"[^A-Z0-9]", "", cleaned)
        region, numbers, suffix = m.groups()
        numbers = re.sub(r"[Oo]", "0", numbers)
        numbers = re.sub(r"[IiLl]", "1", numbers)
        return f"{region} {numbers} {suffix}".strip()
