"""検証用: 写真1枚から Chrome の擬似カメラ用 MJPEG を生成する。使い方: python3 make_fake_cam.py 入力.jpg 出力.mjpeg"""
import io, sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
# 実機との差異を模擬: 軽度の回転・拡大・減光
im = im.rotate(4, resample=Image.BICUBIC, expand=False)
w, h = im.size
im = im.crop((int(w * .06), int(h * .06), int(w * .94), int(h * .94))).resize((720, 1280))
im = im.point(lambda v: int(v * .9))
b = io.BytesIO(); im.save(b, 'JPEG', quality=85)
open(sys.argv[2], 'wb').write(b.getvalue() * 30)
