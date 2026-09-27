import unittest

from src.modules.ocr.service import PlatePostProcessor, MockEdgeOcrEngine


class TestOcrPostProcessor(unittest.TestCase):
    def test_o_to_zero(self):
        self.assertEqual(PlatePostProcessor.fix_common_ocr_errors("B O1I4 ABC"), "B 0114 ABC")

    def test_i_to_one(self):
        self.assertEqual(PlatePostProcessor.fix_common_ocr_errors("B 1L99 Z"), "B 1199 Z")

    def test_keeps_region_and_suffix(self):
        self.assertEqual(PlatePostProcessor.fix_common_ocr_errors("b 1234 abc"), "B 1234 ABC")

    def test_mock_engine(self):
        plate, conf = MockEdgeOcrEngine().process_frame(b"frame")
        self.assertIsNotNone(plate)
        self.assertGreaterEqual(conf, 0.0)


if __name__ == "__main__":
    unittest.main()
