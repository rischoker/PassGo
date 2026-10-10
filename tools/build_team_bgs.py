"""Cut the two character-selection backgrounds out of tools/raw/team-backgrounds.png -> assets/teams/"""
import os
from PIL import Image
os.makedirs("assets/teams", exist_ok=True)
im = Image.open("tools/raw/team-backgrounds.png").convert("RGB")
for name, box in {"nico-bg": (28, 24, 812, 914), "massie-bg": (866, 24, 1646, 914)}.items():
    c = im.crop(box); c.save(f"assets/teams/{name}.webp", quality=86, method=6); print(name, c.size)
