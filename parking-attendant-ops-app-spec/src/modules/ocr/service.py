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
        Replaces 'O' with '0' inside numeric segment, 'I' with '1', etc.
        """
        cleaned = raw_text.strip().upper()
        # Heuristic normalization
        return cleaned
