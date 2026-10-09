"""Cut the 6 unit stamps out of tools/raw/stamps-sheet.png (3x2 grid on white) -> assets/stamps/unitN.webp"""
import cv2, numpy as np, os
from PIL import Image
os.makedirs("assets/stamps", exist_ok=True)
img = cv2.imread("tools/raw/stamps-sheet.png"); H, W = img.shape[:2]
for i in range(6):
    c, r = i % 3, i // 3
    cell = img[r * H // 2:(r + 1) * H // 2, c * W // 3:(c + 1) * W // 3].copy()
    mn = cell.min(axis=2).astype(int); sat = cell.max(axis=2).astype(int) - mn
    white = ((mn > 225) & (sat < 25)).astype(np.uint8)
    n, lab = cv2.connectedComponents(white, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border)).astype(np.uint8)
    alpha = (1 - bg) * 255
    alpha = cv2.GaussianBlur(alpha.astype(np.uint8), (3, 3), 0)
    rgba = cv2.cvtColor(cell, cv2.COLOR_BGR2RGBA); rgba[..., 3] = alpha
    ys, xs = np.where(alpha > 20)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(rgba); im.thumbnail((420, 420), Image.LANCZOS)
    im.save(f"assets/stamps/unit{i+1}.webp", quality=88, method=6)
    print(i + 1, im.size)
