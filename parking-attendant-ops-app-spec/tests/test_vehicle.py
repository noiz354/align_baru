import unittest

from src.modules.vehicle.service import PlateSanitizer, ObservedItemBuilder


class TestPlateSanitizer(unittest.TestCase):
    def test_basic_format(self):
        p = PlateSanitizer.sanitize("B 1234 abc")
        self.assertEqual(p.canonical, "B1234ABC")
        self.assertEqual(p.display_format, "B 1234 ABC")

    def test_strips_symbols(self):
        p = PlateSanitizer.sanitize("b-1234.abc")
        self.assertEqual(p.canonical, "B1234ABC")

    def test_no_separator_input(self):
        p = PlateSanitizer.sanitize("BK8812TAA")
        self.assertEqual(p.canonical, "BK8812TAA")
        self.assertEqual(p.display_format, "BK 8812 TAA")

    def test_nonstandard_fallback(self):
        p = PlateSanitizer.sanitize("RI 1")
        self.assertEqual(p.canonical, "RI1")

    def test_different_letter_counts(self):
        p = PlateSanitizer.sanitize("D 99 Z")
        self.assertEqual(p.display_format, "D 99 Z")
        self.assertEqual(p.canonical, "D99Z")


class TestObservedItemBuilder(unittest.TestCase):
    def test_quick_helmet(self):
        item = ObservedItemBuilder.helmet(count=2)
        self.assertEqual(item.item_type, "HELMET")
        self.assertEqual(item.count, 2)

    def test_invalid_type(self):
        with self.assertRaises(ValueError):
            ObservedItemBuilder.quick("GOLD_BAR")

    def test_from_dict_list(self):
        items = ObservedItemBuilder.from_dict_list([
            {"item_type": "BAG", "count": 1, "location": "SEAT"},
        ])
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].location_on_vehicle, "SEAT")


if __name__ == "__main__":
    unittest.main()
