# TJ_ComfyUI_ColorUtility

高精度な RGB/HSV/Alpha カラーピッカーを ComfyUI のカスタムノードとして提供します。

## 特長
- 色相環 + 中央 SV 正方形 (ピクセル単位 HSV→RGB 変換により端の純白/純黒を保証)
- アルファバー + RGBA プレビュー (チェック柄背景)
- #RRGGBB と #RRGGBBAA の 2 出力 (互換性維持のため従来 hex_color も提供)
- ズーム/パン追従する安定したオーバーレイ位置計算
- HiDPI / スケール対応 (devicePixelRatio 利用)
- 端スナップ (左上=白 / 右下=黒) により色の再現性を確保

## インストール
1. ComfyUI の `custom_nodes` ディレクトリへ本リポジトリを配置 (もしくは git clone)。
```powershell
cd <ComfyUI>/custom_nodes
git clone https://github.com/TJ16th/TJ_ComfyUI_ColorUtility.git tj_ComfyUIUtil
```
2. ComfyUI を再起動。
3. ノード検索で `RGB Color Picker` を追加。

## 使い方
- RGB スライダーはピッカー操作で自動更新されます。
- 色相：リング部分をドラッグ
- 彩度/明度：中央の正方形をドラッグ (端/隅で純白/純黒を取得)
- アルファ：下部バーを左右へドラッグ
- 出力:
  - `hex_color` : `#RRGGBB`
  - `hex_color_rgba` : `#RRGGBBAA`

## アップデート計画 (例)
- キーボード操作対応
- 可変リング太さ/サイズ設定
- HSV / HSL 数値ウィジェット追加

## ライセンス
本リポジトリは MIT License です。詳細は `LICENSE` を参照してください。

## 貢献
Issue / Pull Request 歓迎です。バグ報告には再現手順と環境情報 (OS, ブラウザ, ComfyUI バージョン) を添えてください。

---
Created by TJ16th. Enjoy creative coloring!
