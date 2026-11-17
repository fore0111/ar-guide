"""AR用素材の写真から認識用ターゲット画像を生成する（下部の方位ストリップを除去して縮小）。"""
import glob, json, os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'AR用素材')
OUT = os.path.join(os.path.dirname(__file__), '..', 'targets')
STRIP_TOP = 1820          # これより下は方位・座標のストリップ
WIDTH = 720

# 地点 -> [(時刻, 切り出す下端の比率)]。比率は指の写り込みなどを除去するため。
# 除外: 100634（無地の壁面）と 100855（ルーバーのみ）は特徴点が不足し認識不可
PLAN = {
    '8': [('095654', 1.0), ('095720', 1.0), ('095757', 0.62)],
    '1': [('100153', 1.0), ('100213', 1.0), ('100244', 1.0), ('100255', 1.0), ('100309', 1.0)],
    '2': [('100523', 1.0), ('100532', 1.0), ('100558', 1.0), ('100611', 1.0),
          ('100632', 1.0), ('100644', 1.0)],
    '3': [('100804', 1.0), ('100812', 1.0), ('100818', 1.0), ('100825', 1.0), ('100833', 1.0),
          ('100902', 1.0), ('100904', 1.0), ('100916', 1.0), ('100918', 1.0)],
}
manifest = {}
for point, items in PLAN.items():
    manifest[point] = []
    for i, (t, ratio) in enumerate(items):
        f = sorted(glob.glob(os.path.join(SRC, f'compass_20261117_{t}_*.jpg')))[0]
        im = Image.open(f).convert('RGB')
        im = im.crop((0, 0, im.width, int(STRIP_TOP * ratio)))
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        name = f'p{point}_{i}_{t}.jpg'
        im.save(os.path.join(OUT, name), quality=85)
        manifest[point].append({'file': name, 'aspect': round(im.height / im.width, 4),
                                'source': os.path.basename(f)})
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in manifest.items()})
