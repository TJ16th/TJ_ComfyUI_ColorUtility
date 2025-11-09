import unittest
import numpy as np

try:
    import torch  # type: ignore
except Exception:  # pragma: no cover
    torch = None  # type: ignore

from image_palette_extractor import ImagePaletteExtractor


class TestImagePaletteExtractor(unittest.TestCase):
    def _make_test_image(self):
        # Create 256x256 image with 8 color stripes
        H, W = 256, 256
        colors = np.array([
            [1.0, 0.0, 0.0],  # red
            [0.0, 1.0, 0.0],  # green
            [0.0, 0.0, 1.0],  # blue
            [1.0, 1.0, 0.0],  # yellow
            [1.0, 0.0, 1.0],  # magenta
            [0.0, 1.0, 1.0],  # cyan
            [1.0, 1.0, 1.0],  # white
            [0.0, 0.0, 0.0],  # black
        ], dtype=np.float64)
        img = np.zeros((H, W, 3), dtype=np.float64)
        stripe = H // 8
        for i in range(8):
            img[i*stripe:(i+1)*stripe, :, :] = colors[i]
        if torch is not None:
            t = torch.from_numpy(img.astype(np.float32)).unsqueeze(0)  # 1,H,W,3
            return t
        return img

    def test_extract_palette(self):
        node = ImagePaletteExtractor()
        image = self._make_test_image()
        out = node.extract_palette(image, sample_max_pixels=50_000, seed=1)
        self.assertEqual(len(out), 9)
        custom_json = out[0]
        colors = out[1:]
        self.assertTrue(custom_json.startswith('{'))
        self.assertEqual(len(colors), 8)
        self.assertTrue(all(isinstance(c, str) and c.startswith('#') for c in colors))


if __name__ == '__main__':
    unittest.main()
