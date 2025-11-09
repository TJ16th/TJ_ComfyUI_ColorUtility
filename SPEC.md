# RGBカラーピッカーノード 仕様書

## 概要
RGBスライダーとカラープレビューを備えたComfyUIカスタムノード。
ユーザーがRGB値を視覚的に選択でき、HEX形式のカラーコードを出力する。

## ノード名
`RGBColorPicker`

## 入力パラメータ
| パラメータ名 | 型 | 範囲 | デフォルト値 | 説明 |
|------------|------|------|------------|------|
| red | INT | 0-255 | 255 | 赤色の値 |
| green | INT | 0-255 | 0 | 緑色の値 |
| blue | INT | 0-255 | 0 | 青色の値 |

## 出力
| 出力名 | 型 | 形式 | 説明 |
|--------|------|------|------|
| hex_color | STRING | #RRGGBB | HEX形式のカラーコード(例: #FF0000) |

## UI機能
1. **RGBスライダー**
   - 各色(R/G/B)に対応する3つのスライダー
   - 範囲: 0-255
   - リアルタイムでカラープレビューに反映

2. **ビジュアルカラーピッカー**
   - カラーホイール(色相環)
   - 中央の明度・彩度グラデーションパネル
   - インタラクティブな色選択
   - マウスクリック/ドラッグで色を選択
   - 選択した色をRGBスライダーに反映

3. **カラープレビュー**
   - 現在選択されているRGB値の色を表示
   - スライダー操作に応じて即座に更新
   - ビジュアルピッカーの操作にも連動

## 動作仕様
1. ユーザーが各スライダーでRGB値を設定
2. RGB値(R, G, B)をHEX形式(#RRGGBB)に変換
3. 各8bit値を16進数2桁に変換して連結
4. HEX文字列を出力として返す

### 変換例
- RGB(255, 0, 0) → `#FF0000` (赤)
- RGB(0, 255, 0) → `#00FF00` (緑)
- RGB(0, 0, 255) → `#0000FF` (青)
- RGB(171, 205, 239) → `#ABCDEF`
- RGB(255, 255, 255) → `#FFFFFF` (白)
- RGB(0, 0, 0) → `#000000` (黒)

## カテゴリ
`TJnodes/color`

## 技術仕様
### Python側
- 言語: Python
- フレームワーク: ComfyUI Custom Node API
- 必要なライブラリ: なし(標準ライブラリのみ)

### JavaScript側
- Canvas API: カラーホイールとグラデーション描画
- DOM API: インタラクティブUI構築
- 必要なライブラリ: なし(vanilla JS)
- 色空間変換: RGB ⇔ HSV カスタム実装

## ファイル構成
```
tj_ComfyUIUtil/
├── __init__.py          # ノード登録とWEB_DIRECTORYのエクスポート
├── rgb_color_picker.py  # メインノード実装
├── js/
│   └── rgb_color_picker.js  # カラープレビュー用JavaScript拡張
└── SPEC.md             # 本仕様書
```

## 実装のポイント

### Python側 (rgb_color_picker.py)
- クラス名: `RGBColorPicker`
- `INPUT_TYPES`でスライダー(0-255)を定義
  - `"red": ("INT", {"default": 255, "min": 0, "max": 255, "step": 1})`
  - `"green": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1})`
  - `"blue": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1})`
- `RETURN_TYPES = ("STRING",)`
- `RETURN_NAMES = ("hex_color",)`
- `FUNCTION = "convert_to_hex"`
- RGB→HEX変換は`"#{:02X}{:02X}{:02X}".format(r, g, b)`を使用
- カテゴリは`"TJnodes/color"`

### JavaScript側 (js/rgb_color_picker.js)
- `app.registerExtension`で拡張を登録
- `beforeRegisterNodeDef`フックでノードタイプを検出(`nodeData.name === "RGBColorPicker"`)
- カスタムウィジェットとして以下を実装:
  1. **カラーホイール(色相環)**: Canvas APIで描画
  2. **明度・彩度グラデーション**: 中央の矩形領域
  3. **カラープレビュー**: 選択色の表示
  4. **インタラクション**:
     - マウスクリック/ドラッグでホイールと中央パネルから色を選択
     - RGB値とHSV値の相互変換
     - スライダー変更時にピッカーUIを更新
     - ピッカー操作時にスライダーを更新
- ウィジェットの`draw`メソッドでDOM要素の位置を更新
- RGB ⇔ HSV 変換関数を実装
- 参考: Pickr.js のようなカラーピッカーUI

### __init__.py
- `NODE_CLASS_MAPPINGS`でノードクラスをマッピング
- `NODE_DISPLAY_NAME_MAPPINGS`で表示名を設定
- `WEB_DIRECTORY = "./js"`をエクスポート
- `__all__`に`WEB_DIRECTORY`を含める
