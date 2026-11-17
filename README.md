# 技大祭 ARガイド（MindAR 版）

地点を選択し、カメラを建物へ向けると、企画情報を建物の上に表示する WebAR。

## 構成

| パス | 内容 |
|---|---|
| `index.html` | アプリ本体（地点選択 → AR 表示） |
| `data/points.json` | 地点・ターゲット・企画ラベルの定義（`u`,`v` は画像左上基準の相対位置） |
| `targets/*.jpg` | 認識用画像（`AR用素材` から生成） |
| `targets/p*.mind` | 地点別の MindAR 認識データ |
| `vendor/` | MindAR 1.2.5 と three.js 0.160（CDN 非依存） |
| `tools/` | 画像生成・コンパイル・検証のスクリプト |

## 操作

```sh
node tools/serve.mjs 8080              # ローカル確認（カメラは localhost か HTTPS のみ動作）
python3 tools/prepare_targets.py       # 写真の追加・変更後にターゲット画像を再生成
node tools/compile.mjs [地点番号...]   # .mind を再コンパイル（初回のみ tools で npm i）
node tools/test.mjs 8 映像.mjpeg 出力.png   # 擬似カメラで認識を検証
```

- `index.html?p=8` で地点を直接指定して起動（QR コード用）
- `&debug` を追加するとターゲットの外枠を表示
- 企画の文言・位置の修正は `data/points.json` のみで完結（再コンパイル不要）
- 写真の追加時は `tools/prepare_targets.py` の `PLAN` と `data/points.json` の `targets` を同一の順序で更新
