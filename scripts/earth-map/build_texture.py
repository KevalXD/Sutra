"""Build an equirectangular (2:1, lon -180..180 / lat 90..-90) Earth texture from Natural Earth data."""
import sys, json, math
sys.path.insert(0, "/tmp/claude-0/-home-claude/5f80a000-2c54-5ed8-aa2c-10bc7d1e3a8e/scratchpad/tools")
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from geo import load, polygons, raster_land_seam, ring_variants

OUT = "/tmp/claude-0/-home-claude/5f80a000-2c54-5ed8-aa2c-10bc7d1e3a8e/scratchpad/out"
W, H = 4096, 2048          # final size
SS = 2                     # supersampling for crisp, antialiased coastlines
WH, HH = W * SS, H * SS

land = load(f"{OUT}/land.geojson")
borders = load(f"{OUT}/borders.geojson")

def proj(lo, la, w=WH, h=HH):
    return ((lo + 180.0) / 360.0 * w, (90.0 - la) / 180.0 * h)

def down(img):
    return np.asarray(img.resize((W, H), Image.BOX), dtype=np.float32) / 255.0

# --- masks ------------------------------------------------------------------
cov = down(Image.fromarray((raster_land_seam(land, proj, WH, HH) * 255).astype(np.uint8)))

coast_img = Image.new("L", (WH, HH), 0)
d = ImageDraw.Draw(coast_img)
for poly in polygons(land):
    for ring in poly:
        for pts, polar in ring_variants(ring):
            if polar:
                pts = pts[:-2]  # drop the artificial closure through the pole
            if max(p[0] for p in pts) < -180 or min(p[0] for p in pts) > 180:
                continue
            for a, b2 in zip(pts, pts[1:]):
                if a[1] < -89.5 and b2[1] < -89.5: continue
                if abs(a[0]) in (180.0,) and abs(b2[0]) in (180.0,) and a[0] == b2[0]: continue  # edge lying on the seam
                d.line([proj(*a), proj(*b2)], fill=255, width=3)
coast = down(coast_img)

border_img = Image.new("L", (WH, HH), 0)
d = ImageDraw.Draw(border_img)
lines = borders["coordinates"] if borders["type"] == "MultiLineString" else [borders["coordinates"]]
for line in lines:
    pts = [proj(lo, la) for lo, la in line]
    for a, b in zip(pts, pts[1:]):
        if abs(a[0] - b[0]) > WH * 0.5: continue
        d.line([a, b], fill=255, width=2)
borders_a = down(border_img)

# --- palette (Sutra: dark navy + refined green) -----------------------------
OCEAN_DEEP = np.array([9, 30, 47], np.float32)
OCEAN_SHELF = np.array([20, 76, 92], np.float32)
LAND_TROP = np.array([40, 104, 76], np.float32)
LAND_MID = np.array([62, 124, 86], np.float32)
LAND_ARID = np.array([112, 122, 82], np.float32)
LAND_ICE = np.array([176, 208, 196], np.float32)
COAST = np.array([140, 236, 188], np.float32)
BORDER = np.array([200, 240, 220], np.float32)
GRID = np.array([121, 226, 168], np.float32)

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

lat = (90.0 - (np.arange(H) + 0.5) / H * 180.0)[:, None]          # (H,1)
alat = np.abs(lat)
tropical = 1 - smooth(8, 40, alat)
arid = np.exp(-((alat - 24.0) / 9.0) ** 2) * 0.38
ice = smooth(63, 76, alat)
land_rgb = (LAND_TROP * tropical[..., None] + LAND_MID * (1 - tropical[..., None]))   # (H,1,3)
land_rgb = land_rgb * (1 - arid[..., None]) + LAND_ARID * arid[..., None]
land_rgb = land_rgb * (1 - ice[..., None] * 0.9) + LAND_ICE * ice[..., None] * 0.9
land_rgb = np.broadcast_to(land_rgb, (H, W, 3))

# soft continental shelf: blur coverage, only visible over water
blur = np.asarray(Image.fromarray((cov * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(16)), np.float32) / 255.0
shelf = smooth(0.06, 0.55, blur) * 0.85
ocean_rgb = OCEAN_DEEP * (1 - shelf[..., None]) + OCEAN_SHELF * shelf[..., None]
# very subtle polar brightening of the ocean so the poles read as ice-adjacent
ocean_rgb = ocean_rgb + (np.array([18, 28, 30], np.float32) * smooth(70, 90, alat)[..., None]) * (1 - cov[..., None])

rgb = ocean_rgb * (1 - cov[..., None]) + land_rgb * cov[..., None]

# graticule every 30 degrees (very faint)
grid = np.zeros((H, W), np.float32)
for lon in range(-180, 181, 30):
    x = int(round((lon + 180) / 360 * (W - 1))); grid[:, max(x - 0, 0):x + 1] = 1
for la in range(-60, 61, 30):
    y = int(round((90 - la) / 180 * (H - 1))); grid[y:y + 1, :] = 1
rgb = rgb * (1 - grid[..., None] * 0.10) + GRID * (grid[..., None] * 0.10)

rgb = rgb * (1 - borders_a[..., None] * 0.20) + BORDER * (borders_a[..., None] * 0.20)
rgb = rgb * (1 - coast[..., None] * 0.55) + COAST * (coast[..., None] * 0.55)

img = Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8), "RGB")
img.save(f"{OUT}/earth-map.png", optimize=True)
img.save(f"{OUT}/earth-map.webp", quality=90, method=6)
Image.fromarray((cov * 255).astype(np.uint8)).save(f"{OUT}/land-mask.png")
img.resize((1600, 800), Image.LANCZOS).save(f"{OUT}/earth-map-preview.png")
print("done", img.size)
