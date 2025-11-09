from __future__ import annotations

from typing import Tuple


class RGBColorPicker:
    """
    ComfyUI custom node: RGBColorPicker
    - Inputs: red, green, blue (0-255), alpha (0-255)
    - Output: hex_color ("#RRGGBB")  # 互換性維持のためアルファは出力に含めない
    - Category: TJnodes/color
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "red": ("INT", {"default": 255, "min": 0, "max": 255, "step": 1}),
                "green": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
                "blue": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
                "alpha": ("INT", {"default": 255, "min": 0, "max": 255, "step": 1}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("hex_color", "hex_color_rgba")
    FUNCTION = "convert_to_hex"
    CATEGORY = "TJnodes/color"

    def convert_to_hex(self, red: int, green: int, blue: int, alpha: int = 255) -> Tuple[str, str]:
        r = max(0, min(255, int(red)))
        g = max(0, min(255, int(green)))
        b = max(0, min(255, int(blue)))
        a = max(0, min(255, int(alpha)))
        hex_color = f"#{r:02X}{g:02X}{b:02X}"
        hex_color_rgba = f"#{r:02X}{g:02X}{b:02X}{a:02X}"
        return (hex_color, hex_color_rgba)
