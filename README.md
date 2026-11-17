# 技大祭 ARガイド

カメラを周囲へ向けると、企画の開催場所を方向と距離で表示する WebAR。

- **通常版（`index.html`）**：GPS と方位センサーを使用し、会場の全域で動作。建物形状（OpenStreetMap）へのレイキャストで「正面の建物」と遮蔽を判定。企画一覧、目的地への案内、ミニマップを搭載。
- **画像認識版（`image.html`）**：MindAR による画像追跡。登録4地点限定の実験版。

通常版の検証用パラメーター：`?sim=緯度,経度,方位`（位置と方位を固定）、`?fov=65`（カメラ長辺の画角）。

## 構成

| パス | 内容 |
|---|---|
| `index.html` | 通常版の本体 |
| `data/events.json` | 通常版の企画データ（建物名または緯度経度で位置を指定） |
| `data/buildings.json` | 建物形状（© OpenStreetMap contributors、`tools/build_buildings.py` で生成） |
| `image.html` | 画像認識版の本体（地点選択 → AR 表示） |
| `data/points.json` | 画像認識版の地点・ターゲット・企画ラベルの定義（`u`,`v` は画像左上基準の相対位置） |
| `targets/*.jpg` | 認識用画像（`AR用素材` から生成） |
| `targets/p*.mind` | 地点別の MindAR 認識データ |
| `vendor/` | MindAR 1.2.5 と three.js 0.160（CDN 非依存） |
| `tools/` | 画像生成・コンパイル・検証のスクリプト |

## 操作

```sh
node tools/serve.mjs 8080              # ローカル確認（カメラは localhost か HTTPS のみ動作）
python3 tools/prepare_targets.py       # 写真の追加・変更後にターゲット画像を再生成
node tools/compile.mjs [地点番号...]   # .mind を再コンパイル（初回のみ tools で npm i）
node tools/test.mjs 8 映像.mjpeg 出力.png   # 画像認識版を擬似カメラで検証
node tools/test_geo.mjs 37.42581,138.77900,89 映像.mjpeg 出力.png   # 通常版を位置・方位の模擬で検証
```

- `image.html?p=8` で地点を直接指定して起動（QR コード用）
- `&debug` を追加するとターゲットの外枠を表示
- 企画の文言・位置の修正は `data/points.json` のみで完結（再コンパイル不要）
- 写真の追加時は `tools/prepare_targets.py` の `PLAN` と `data/points.json` の `targets` を同一の順序で更新
