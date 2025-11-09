import unittest
import json
from pathlib import Path

from color_palette import ColorPalette


class TestColorPalette(unittest.TestCase):
    def setUp(self):
        self.node = ColorPalette()

    def test_list_presets(self):
        """palettes/ に存在するプリセット一覧を取得"""
        presets = self.node.list_presets()
        self.assertIsInstance(presets, list)
        self.assertIn("primary", presets)
        self.assertIn("pastel", presets)
        self.assertIn("gansai", presets)
        self.assertIn("monochrome", presets)

    def test_load_primary(self):
        """primary.json の8色が正しく読み込まれる"""
        colors = self.node.load_palette("primary")
        self.assertEqual(len(colors), 8)
        self.assertTrue(all(c.startswith("#") for c in colors))
        self.assertEqual(colors[0], "#FF0000")  # red
        self.assertEqual(colors[6], "#FFFFFF")  # white

    def test_load_monochrome(self):
        """monochrome.json のグラデーションが正しい"""
        colors = self.node.load_palette("monochrome")
        self.assertEqual(len(colors), 8)
        self.assertEqual(colors[0], "#FFFFFF")  # white start
        self.assertEqual(colors[7], "#000000")  # black end

    def test_get_palette_output(self):
        """get_palette が8要素のタプルを返す"""
        result = self.node.get_palette("primary")
        self.assertIsInstance(result, tuple)
        self.assertEqual(len(result), 8)
        self.assertTrue(all(isinstance(c, str) for c in result))

    def test_nonexistent_preset_fallback(self):
        """存在しないプリセットはフォールバックで8色を返す"""
        colors = self.node.load_palette("nonexistent")
        self.assertEqual(len(colors), 8)
        self.assertTrue(all(c.startswith("#") for c in colors))

    def test_custom_palette(self):
        """カスタムパレット (custom.json) を動的作成して検証"""
        custom_path = self.node.palettes_dir / "custom.json"
        custom_data = {
            "name": "Custom Test",
            "colors": ["#AAAAAA"] * 8
        }
        try:
            with open(custom_path, "w", encoding="utf-8") as f:
                json.dump(custom_data, f)
            
            # キャッシュをクリア
            self.node._palette_cache.clear()
            
            colors = self.node.load_palette("custom")
            self.assertEqual(len(colors), 8)
            self.assertEqual(colors[0], "#AAAAAA")
        finally:
            if custom_path.exists():
                custom_path.unlink()


if __name__ == "__main__":
    unittest.main()
