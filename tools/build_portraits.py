"""Clean the character portraits (remove glow/halo leftovers) -> assets/portraits/<name>.webp"""
import cv2, numpy as np, os
from PIL import Image
os.makedirs("assets/portraits", exist_ok=True)
SRC = {"nico": "tools/raw/nico-portrait-new.png", "massie": "tools/raw/massie-portrait.png",
       "luma": "tools/raw/luma-portrait.png", "luna": "tools/raw/luna-portrait.png"}
for name, path in SRC.items():
    a = np.array(Image.open(path).convert("RGBA")).astype(np.float32)
    al = a[..., 3]
    # halos are low alpha; the character is (almost) opaque
    solid = (al > 200).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    k = 1 + np.argmax(st[1:, 4]); body = (lab == k).astype(np.uint8)
    # fill holes, then soften the edge a little
    cnts, _ = cv2.findContours(body, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(body); cv2.drawContours(filled, cnts, -1, 1, -1)
    edge = cv2.GaussianBlur(filled.astype(np.float32) * 255, (5, 5), 0)
    a[..., 3] = np.minimum(edge, np.maximum(al, edge * (filled > 0)))
    ys, xs = np.where(a[..., 3] > 10)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8)); im.thumbnail((640, 640), Image.LANCZOS)
    im.save(f"assets/portraits/{name}.webp", quality=88, method=6); print(name, im.size)
