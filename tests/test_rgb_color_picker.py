import unittest

from rgb_color_picker import RGBColorPicker


class TestRGBColorPicker(unittest.TestCase):
    def setUp(self):
        self.node = RGBColorPicker()

    def check(self, rgb, expected_hex, expected_rgba=None, alpha=255):
        res = self.node.convert_to_hex(*rgb, alpha)
        self.assertEqual(res[0], expected_hex)
        if expected_rgba is not None:
            self.assertEqual(res[1], expected_rgba)

    def test_primary_colors(self):
        self.check((255, 0, 0), "#FF0000", "#FF0000FF")
        self.check((0, 255, 0), "#00FF00", "#00FF00FF")
        self.check((0, 0, 255), "#0000FF", "#0000FFFF")

    def test_grayscale(self):
        self.check((0, 0, 0), "#000000", "#000000FF")
        self.check((255, 255, 255), "#FFFFFF", "#FFFFFFFF")
        self.check((128, 128, 128), "#808080", "#808080FF")

    def test_random_value(self):
        self.check((171, 205, 239), "#ABCDEF", "#ABCDEFFF")

    def test_alpha_variation(self):
        self.check((10, 20, 30), "#0A141E", "#0A141E80", alpha=128)
        self.check((10, 20, 30), "#0A141E", "#0A141E00", alpha=0)
        self.check((10, 20, 30), "#0A141E", "#0A141EFF", alpha=255)

    def test_clamp_low(self):
        self.check((-5, 10, 10), "#000A0A", "#000A0AFF")

    def test_clamp_high(self):
        self.check((300, 10, 10), "#FF0A0A", "#FF0A0AFF")


if __name__ == "__main__":
    unittest.main() 
