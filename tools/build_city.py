"""
City map pipeline (English A2 city adventure).
Run from the repo root:  python3 tools/build_city.py
Input : tools/raw/city-map.png (1536x1024 illustrated city with parchment border)
Output: assets/world/city-map.webp      map with the sailboat and pirate flag painted out
        assets/world/city-boat.png      sailboat sprite (bobs on the sea)
        assets/world/city-flag.png      pirate flag (waves on the fortress)
        assets/world/city-sea-mask.png  where the water shimmer goes
        assets/world/city-fog-mask.png  inside of the parchment frame (fog lives here) + lighter fog on water
        js/world-data.js                unit nodes, character stand points, road routes, bird perches
"""
import cv2, heapq, json, os
import numpy as np
from PIL import Image

os.makedirs("assets/world", exist_ok=True)
SRC = cv2.imread("tools/raw/city-map.png")
H, W = SRC.shape[:2]
pct = lambda x, y: [round(x / W * 100, 2), round(y / H * 100, 2)]

# ---------- 1. sprites cut out of the art (grabCut) + inpaint ----------
def cut(box, rect_pad=6, extra_keep=None):
    x0, y0, x1, y1 = box
    roi = SRC[y0:y1, x0:x1].copy()
    m = np.zeros(roi.shape[:2], np.uint8); bg = np.zeros((1, 65)); fg = np.zeros((1, 65))
    cv2.grabCut(roi, m, (rect_pad, rect_pad, x1 - x0 - 2 * rect_pad, y1 - y0 - 2 * rect_pad), bg, fg, 8, cv2.GC_INIT_WITH_RECT)
    mask = ((m == 1) | (m == 3)).astype(np.uint8) * 255
    b, g, r = [roi[..., i].astype(int) for i in range(3)]
    if extra_keep is not None: mask = np.where(extra_keep(b, g, r), mask, 0).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
    if n > 1:
        k = 1 + np.argmax(st[1:, 4]); mask = np.where(lab == k, 255, 0).astype(np.uint8)
    hard = mask.copy()
    soft = cv2.GaussianBlur(mask, (3, 3), 0)
    rgba = cv2.cvtColor(roi, cv2.COLOR_BGR2BGRA); rgba[..., 3] = soft
    return rgba, hard

# sailboat: hull + sails, not the blue sea around it
boat_box = (1346, 788, 1452, 930)
not_sea = lambda b, g, r: ~((b > r + 45) & (b > g - 10) & ((r + g + b) < 640))
boat, boat_hard = cut(boat_box, 4, not_sea)
cv2.imwrite("assets/world/city-boat.png", boat)
# pirate flag: dark cloth + white skull, right of the mast
flag_box = (1299, 452, 1350, 510)
fx0, fy0, fx1, fy1 = flag_box
froi = SRC[fy0:fy1, fx0:fx1]
fb, fg_, fr = [froi[..., i].astype(int) for i in range(3)]
dark = ((fb + fg_ + fr) < 210) | (((fb + fg_ + fr) > 560) & (np.abs(fr - fb) < 40))
fmask = cv2.morphologyEx(dark.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(fmask)
k = 1 + np.argmax(st[1:, 4]); fmask = np.where(lab == k, 255, 0).astype(np.uint8)
fmask = cv2.morphologyEx(fmask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
flag = cv2.cvtColor(froi, cv2.COLOR_BGR2BGRA); flag[..., 3] = cv2.GaussianBlur(fmask, (3, 3), 0)
cv2.imwrite("assets/world/city-flag.png", flag)

full = np.zeros((H, W), np.uint8)
full[boat_box[1]:boat_box[3], boat_box[0]:boat_box[2]] = boat_hard
full[fy0:fy1, fx0:fx1] = np.maximum(full[fy0:fy1, fx0:fx1], fmask)
full = cv2.dilate(full, np.ones((7, 7), np.uint8))
clean = cv2.inpaint(SRC, full, 6, cv2.INPAINT_TELEA)
Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB)).save("assets/world/city-map.webp", quality=86, method=6)

# ---------- 2. masks ----------
b, g, r = [clean[..., i].astype(int) for i in range(3)]
water = ((b > r + 40) & (b > g) & (b > 120)).astype(np.uint8)
water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(water)
sea = np.zeros_like(water)
for i in range(1, n):
    if st[i, 4] > 2500 and cen[i][1] > H * 0.42: sea[lab == i] = 1
sea = cv2.morphologyEx(sea, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
# parchment frame: tan, low-saturation-ish pixels connected to the image border
hsv = cv2.cvtColor(clean, cv2.COLOR_BGR2HSV)
tan = ((hsv[..., 0] > 8) & (hsv[..., 0] < 30) & (hsv[..., 1] > 50) & (hsv[..., 2] > 150)).astype(np.uint8)
tan = cv2.morphologyEx(tan, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
n, lab = cv2.connectedComponents(tan)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
frame = np.isin(lab, list(border)).astype(np.uint8)
frame = cv2.morphologyEx(frame, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
# keep only the outer band as frame (the inner city has tan plazas too)
band = np.zeros_like(frame); m = int(min(W, H) * 0.075); band[:m] = 1; band[-m:] = 1; band[:, :m] = 1; band[:, -m:] = 1
frame = frame & band
inner = 1 - cv2.dilate(frame, np.ones((15, 15), np.uint8))

def save_mask(arr, name, blur=0, scale=0.5):
    a = (arr * 255).astype(np.uint8)
    if blur: a = cv2.GaussianBlur(a, (0, 0), blur)
    a = cv2.resize(a, (int(W * scale), int(H * scale)), interpolation=cv2.INTER_AREA)
    rgba = np.zeros(a.shape + (4,), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = a
    Image.fromarray(rgba).save("assets/world/" + name, optimize=True)
save_mask(sea & inner, "city-sea-mask.png", blur=2, scale=0.4)
# fog density map: 1 = full fog (city), ~0.45 over water, 0 on the parchment frame
fogd = inner.astype(np.float32) * (1 - 0.55 * cv2.GaussianBlur(sea.astype(np.float32), (0, 0), 6))
save_mask(np.clip(fogd, 0, 1), "city-fog-mask.png", blur=10, scale=0.3)

# ---------- 3. units, stand points, routes ----------
# icon circle of each wooden sign (where the unit badge sits) and a spot on the street beside it
UNITS = [  # icon = round icon of the wooden sign, sign = whole sign box, home = the building, stand = street spot
    {"name": "Hotel",               "icon": (240, 297),  "sign": (208, 263, 402, 332),   "home": (290, 150),  "stand": (428, 352)},
    {"name": "Restaurant",          "icon": (645, 312),  "sign": (618, 283, 836, 342),   "home": (700, 205),  "stand": (842, 352)},
    {"name": "Transportation",      "icon": (1033, 350), "sign": (1001, 318, 1272, 384), "home": (1150, 230), "stand": (958, 452)},
    {"name": "Shopping",            "icon": (243, 672),  "sign": (211, 638, 421, 707),   "home": (210, 520),  "stand": (432, 634)},
    {"name": "Tourist Attractions", "icon": (641, 750),  "sign": (612, 718, 877, 787),   "home": (700, 630),  "stand": (898, 700)},
    {"name": "Final Challenge",     "icon": (1163, 712), "sign": (1131, 678, 1387, 747), "home": (1260, 590), "stand": (1138, 640)},
]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
road = (((mx - mn) < 28) & (mx > 95) & (mx < 200)).astype(np.uint8)
road = cv2.morphologyEx(road, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
road = cv2.morphologyEx(road, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
S = 4
rs = cv2.resize(road.astype(np.float32), (W // S, H // S), interpolation=cv2.INTER_AREA)
ws = cv2.resize((water & (1 - road)).astype(np.float32), (W // S, H // S), interpolation=cv2.INTER_AREA)
fr_s = cv2.resize(frame.astype(np.float32), (W // S, H // S), interpolation=cv2.INTER_AREA)
cost = np.where(rs > .45, 1.0, 9.0) + ws * 80 + fr_s * 200
gh, gw = cost.shape

def snap(p):
    x, y = p[0] // S, p[1] // S
    best, bd = (x, y), 1e9
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            X, Y = x + dx, y + dy
            if 0 <= X < gw and 0 <= Y < gh and rs[Y, X] > .6 and dx * dx + dy * dy < bd: best, bd = (X, Y), dx * dx + dy * dy
    return best

def dijkstra(a, bpt):
    dist = np.full(cost.shape, np.inf); prev = {}
    dist[a[1], a[0]] = 0; pq = [(0, a[0], a[1])]
    nb = [(1,0,1),(-1,0,1),(0,1,1),(0,-1,1),(1,1,1.414),(1,-1,1.414),(-1,1,1.414),(-1,-1,1.414)]
    while pq:
        d, x, y = heapq.heappop(pq)
        if (x, y) == bpt: break
        if d > dist[y, x]: continue
        for dx, dy, f in nb:
            X, Y = x + dx, y + dy
            if 0 <= X < gw and 0 <= Y < gh:
                nd = d + f * (cost[y, x] + cost[Y, X]) / 2
                if nd < dist[Y, X]: dist[Y, X] = nd; prev[(X, Y)] = (x, y); heapq.heappush(pq, (nd, X, Y))
    path = [bpt]
    while path[-1] != a: path.append(prev[path[-1]])
    return path[::-1]

def smooth(pts, it=2):
    p = np.array(pts, float)
    for _ in range(it):
        q = [p[0]]
        for i in range(len(p) - 1): q += [p[i] * .75 + p[i + 1] * .25, p[i] * .25 + p[i + 1] * .75]
        q.append(p[-1]); p = np.array(q)
    return p

stands = [snap(u["stand"]) for u in UNITS]
routes = []
for i in range(len(UNITS) - 1):
    path = dijkstra(stands[i], stands[i + 1])
    path = cv2.approxPolyDP(np.array(path, np.float32).reshape(-1, 1, 2), 1.0, False).reshape(-1, 2).tolist()
    path = smooth(path, 2)
    routes.append([pct(x * S, y * S) for x, y in path])

# bird perches (rooftops, statue, towers…) with the unit whose zone must be uncovered
PERCHES = [
    {"at": (318, 88),   "zone": 1, "name": "hotel roof"},
    {"at": (160, 160),  "zone": 1, "name": "hotel annex"},
    {"at": (700, 150),  "zone": 2, "name": "restaurant roof"},
    {"at": (712, 400),  "zone": 2, "name": "fountain statue"},
    {"at": (1140, 176), "zone": 3, "name": "station roof"},
    {"at": (1192, 56),  "zone": 3, "name": "hilltop statue"},
    {"at": (205, 425),  "zone": 4, "name": "mall roof"},
    {"at": (452, 498),  "zone": 4, "name": "awning"},
    {"at": (606, 538),  "zone": 5, "name": "church tower"},
    {"at": (812, 610),  "zone": 5, "name": "castle wall"},
    {"at": (1352, 548), "zone": 6, "name": "lookout hut"},
    {"at": (1236, 500), "zone": 6, "name": "fortress tower"},
]

dbg = clean.copy()
for rt in routes:
    cv2.polylines(dbg, [np.array([[x / 100 * W, y / 100 * H] for x, y in rt], np.int32)], False, (0, 0, 255), 3)
for u, s in zip(UNITS, stands):
    cv2.circle(dbg, u["icon"], 14, (255, 0, 255), 3); cv2.circle(dbg, (s[0] * S, s[1] * S), 8, (0, 255, 255), -1)
for p in PERCHES: cv2.circle(dbg, p["at"], 6, (255, 255, 0), -1)
os.makedirs("tools/debug", exist_ok=True); cv2.imwrite("tools/debug/city-routes.jpg", dbg)

world = {
    "size": [W, H],
    "nodes": [{"icon": pct(*u["icon"]), "sign": pct(u["sign"][0], u["sign"][1]) + pct(u["sign"][2] - u["sign"][0], u["sign"][3] - u["sign"][1]),
               "home": pct(*u["home"])} for u in UNITS],
    "stand": [{"left": pct(x * S, y * S)[0], "top": pct(x * S, y * S)[1]} for x, y in stands],
    "routes": routes,
    "perches": [{"at": pct(*p["at"]), "zone": p["zone"], "name": p["name"]} for p in PERCHES],
    "boat": dict(zip(["left", "top", "width", "height"], pct(boat_box[0], boat_box[1]) + pct(boat_box[2] - boat_box[0], boat_box[3] - boat_box[1]))),
    "flag": dict(zip(["left", "top", "width", "height"], pct(fx0, fy0) + pct(fx1 - fx0, fy1 - fy0))),
}
open("js/world-data.js", "w").write(
    "// ============================================================\n"
    "// WORLD DATA — generated by tools/build_city.py (re-run it if the map changes).\n"
    "// All coordinates are PERCENTAGES of assets/world/city-map.webp.\n"
    "//   nodes[i]  : the unit's badge (sits on the icon of the wooden sign)\n"
    "//   stand[i]  : where the explorer waits next to unit i+1\n"
    "//   routes[i] : street path from unit i+1 to unit i+2\n"
    "//   perches   : where the parrot can land (zone = unit that must be revealed)\n"
    "// ============================================================\n"
    "const WORLD = " + json.dumps(world, indent=1) + ";\n")
print("ok", [len(r) for r in routes])
