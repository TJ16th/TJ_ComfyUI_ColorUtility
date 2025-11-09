from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Tuple


class ColorPalette:
    """
    ComfyUI custom node: ColorPalette
    - Input: preset (選択式: primary, pastel, gansai, monochrome, またはカスタム)
    - Output: color_1 ~ color_16 (各 #RRGGBB)
    - Category: TJnodes/color
    
    パレットは palettes/ フォルダの JSON から読み込み。
    ユーザーは独自 JSON を追加可能。
    """

    def __init__(self):
        self.palettes_dir = Path(__file__).parent / "palettes"
        self._palette_cache = {}

    @classmethod
    def INPUT_TYPES(cls):
        # palettes/ から利用可能なプリセットを列挙
        instance = cls()
        presets = instance.list_presets()
        return {
            "required": {
                "preset": (presets, {"default": presets[0] if presets else "primary"}),
            }
        }

    RETURN_TYPES = tuple(["STRING"] * 8)
    RETURN_NAMES = tuple([f"color_{i+1}" for i in range(8)])
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

    def get_palette(self, preset: str) -> Tuple[str, ...]:
        """プリセットから16色を取得して返す"""
        colors = self.load_palette(preset)
        return tuple(colors)
