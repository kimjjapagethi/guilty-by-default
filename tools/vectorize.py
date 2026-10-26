"""영상 프레임(흰 배경 + 검은 선)을 SVG 경로로 바꿉니다. 배경이 없고 선 색은 CSS로 바꿀 수 있습니다.
사용: python3 vectorize.py <frames_dir> <out.json> <fps>
필요: pip install potracer pillow numpy"""
import sys, glob, json, numpy as np
from PIL import Image
import potrace

def trace(path, thr=150):
    g = np.asarray(Image.open(path).convert('L'), dtype=np.uint8)
    bm = potrace.Bitmap(g >= thr)  # potracer 는 입력을 한 번 뒤집어 처리하므로 밝은 쪽(배경)을 넘깁니다
    pl = bm.trace(turdsize=12, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.4)
    d = []
    f = lambda p: '%g,%g' % (round(p.x, 1), round(p.y, 1))
    for c in pl:
        d.append('M' + f(c.start_point))
        for s in c.segments:
            if s.is_corner: d.append('L' + f(s.c) + 'L' + f(s.end_point))
            else: d.append('C' + f(s.c1) + ' ' + f(s.c2) + ' ' + f(s.end_point))
        d.append('Z')
    return ''.join(d), g.shape

frames_dir, out, fps = sys.argv[1], sys.argv[2], float(sys.argv[3])
files = sorted(glob.glob(frames_dir + '/*.png'))
frames, shape = [], None
for i, p in enumerate(files):
    d, shape = trace(p); frames.append(d)
    if i % 10 == 0: print(i, len(d), flush=True)
json.dump({'w': shape[1], 'h': shape[0], 'fps': fps, 'frames': frames}, open(out, 'w'), separators=(',', ':'))
print('frames', len(frames), 'bytes', sum(len(x) for x in frames))
