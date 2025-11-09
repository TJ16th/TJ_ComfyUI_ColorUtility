from .rgb_color_picker import RGBColorPicker
from .color_palette import ColorPalette

NODE_CLASS_MAPPINGS = {
    "RGBColorPicker": RGBColorPicker,
    "ColorPalette": ColorPalette,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RGBColorPicker": "RGB Color Picker",
    "ColorPalette": "Color Palette",
}

# Serve frontend JS from the js/ folder
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
