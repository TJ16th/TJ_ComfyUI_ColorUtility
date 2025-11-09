from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Tuple


class ColorPalette:
    """
    ComfyUI custom node: ColorPalette
    - Input:
        preset: primary / pastel / gansai / monochrome / custom
        custom_json: (preset == custom の場合のみ使用) {"colors":["#RRGGBB", ...]} 形式（最大8色）
    - Output: color_0 ~ color_7 (各 #RRGGBB)
    - Category: TJnodes/color

    パレットは palettes/ フォルダの JSON から読み込み。
    custom 選択時は custom_json の内容を直接使用。
    """

    def __init__(self):
        self.palettes_dir = Path(__file__).parent / "palettes"
        self._palette_cache = {}

    @classmethod
    def INPUT_TYPES(cls):
        # palettes/ から利用可能なプリセットを列挙 + custom
        instance = cls()
        presets = instance.list_presets()
        if "custom" not in presets:
            presets.append("custom")
        return {
            "required": {
                "preset": (presets, {"default": presets[0] if presets else "primary"}),
                "custom_json": ("STRING", {"multiline": True, "default": '{"colors":["#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#FFFFFF","#000000"]}'})
            }
        }

    RETURN_TYPES = tuple(["STRING"] * 8)
    RETURN_NAMES = tuple([f"color_{i}" for i in range(8)])
    FUNCTION = "get_palette"
    CATEGORY = "TJnodes/color"

    def list_presets(self) -> list[str]:
        """palettes/ 内の .json ファイルから利用可能なプリセット名を返す"""
        if not self.palettes_dir.exists():
            return ["primary"]
        
        presets = []
        for file in self.palettes_dir.glob("*.json"):
            presets.append(file.stem)
        return sorted(presets) if presets else ["primary"]

    def load_palette(self, preset_name: str) -> list[str]:
        """指定プリセットの色リストを返す。キャッシュ利用。"""
        if preset_name in self._palette_cache:
            return self._palette_cache[preset_name]
        
        palette_file = self.palettes_dir / f"{preset_name}.json"
        if not palette_file.exists():
            # フォールバック: 基本8色 (モノクログラデーション)
            fallback = [f"#{i*32:02X}{i*32:02X}{i*32:02X}" for i in range(8)]
            return fallback
        
        try:
            with open(palette_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                colors = data.get("colors", [])
                # 8色に満たない場合は #000000 で埋める
                while len(colors) < 8:
                    colors.append("#000000")
                # 8色超過は切り捨て
                colors = colors[:8]
                self._palette_cache[preset_name] = colors
                return colors
        except Exception as e:
            print(f"[ColorPalette] Error loading {preset_name}: {e}")
            # エラー時フォールバック
            return [f"#{i*32:02X}{i*32:02X}{i*32:02X}" for i in range(8)]

    def _parse_custom(self, custom_json: str) -> list[str]:
        """custom_json 文字列を解析して #RRGGBB リスト(最大8)を返す。失敗時はグレー階調。"""
        try:
            data = json.loads(custom_json)
            raw = data.get("colors", [])
            colors: list[str] = []
            for c in raw:
                if not isinstance(c, str):
                    continue
                c = c.strip()
                if len(c) == 7 and c.startswith("#"):
                    # 16進検証
                    h = c[1:]
                    if all(ch in "0123456789abcdefABCDEF" for ch in h):
                        colors.append("#" + h.upper())
                if len(colors) >= 8:
                    break
            while len(colors) < 8:
                colors.append("#000000")
            return colors[:8]
        except Exception as e:
            print(f"[ColorPalette] custom_json parse error: {e}")
            return [f"#{i*32:02X}{i*32:02X}{i*32:02X}" for i in range(8)]

    def get_palette(self, preset: str, custom_json: str = "") -> Tuple[str, ...]:
        """プリセットから8色を取得して返す。preset==custom の場合 custom_json を解析。"""
        if preset == "custom":
            colors = self._parse_custom(custom_json)
        else:
            colors = self.load_palette(preset)
        return tuple(colors)
