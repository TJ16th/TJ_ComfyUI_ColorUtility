from .rgb_color_picker import RGBColorPicker

NODE_CLASS_MAPPINGS = {
    "RGBColorPicker": RGBColorPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RGBColorPicker": "RGB Color Picker",
}

# Serve frontend JS from the js/ folder
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
