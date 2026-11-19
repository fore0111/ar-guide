# PV（30秒・1920×1080）

## 素材の差し替え

1. 画面録画を `hackson/PV素材/`（= `pv/media/`）へ配置
2. `pv/shots.json` の該当スロットの `src` を `media/ファイル名` に変更
   - `screenFront`（1 カメラを向ける）/ `screenLabels`（2 会場のどこでも）/ `screenFar`（3 奥の建物もわかる）/ `screenGuide`（4 そのまま案内）
   - `in`：動画の使用開始秒。各場面の尺は 2.6 秒
   - `pt`：引出線が指す画面内の位置（左上 0,0 〜 右下 1,1）
3. BGM を使う場合は `PV素材/bgm.mp3` を配置（末尾2秒で自動フェードアウト）

## 確認と書き出し（ar-guide 直下で実行）

```sh
node tools/render_pv.mjs --prep          # 動画素材をフレーム画像へ展開
node tools/serve.mjs 8080                # http://localhost:8080/pv/ でプレビュー（Space で再生）
node tools/render_pv.mjs                 # pv/out/pv.mp4 へ書き出し（約1分）
node tools/render_pv.mjs --stills 12,20  # 指定秒の静止画のみ
```

## 構成（31秒）

| 秒 | 場面 |
|---|---|
| 0.0–4.4 | 来場者アンケートの回答（`raijousya.md` の原文を引用） |
| 4.4–7.0 | 構内写真＋「会場マップへの不満が、いちばん多かった。」 |
| 7.0–10.0 | 製品名 NAsVI と、紹介する機能「ARガイド」 |
| 10.0–20.8 | 実演：端末＋機能 1〜4（各 2.6 秒） |
| 20.8–27.2 | しくみ：建物の立体化 → レイキャスト → 目的地までの歩行（経路は 3m 格子の A* で探索） |
| 27.2–31.0 | 結び：NAsVI ロゴ、Team NASBI |

配色とロゴは `nasbi-logo.html` に準拠（ナス紫 `#6d28d9`、ヘタの緑 `#10b981`）。
経路の描画は PV 内の演出。アプリ本体の案内は方向の矢印と残距離の表示のみ。
