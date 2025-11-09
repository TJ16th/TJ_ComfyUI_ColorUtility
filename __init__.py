from .rgb_color_picker import RGBColorPicker
from .color_palette import ColorPalette
from aiohttp import web
import server

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

@server.PromptServer.instance.routes.post("/tj_comfyuiutil/palette")
async def get_palette_colors(request):
    """Return colors for a given preset or custom json without executing the node.
    Body: {"preset":"primary"} or {"preset":"custom","custom_json":"{...}"}
    """
    try:
        data = await request.json()
        preset = data.get("preset", "primary")
        custom_json = data.get("custom_json", "")
        palette_node = ColorPalette()
        if preset == "custom":
            colors = palette_node._parse_custom(custom_json)
        else:
            colors = palette_node.load_palette(preset)
        return web.json_response(colors)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
