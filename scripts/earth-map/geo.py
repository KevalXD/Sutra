import json, math
import numpy as np
from PIL import Image, ImageDraw

def load(path):
    g = json.load(open(path))
    return g["features"][0]["geometry"] if g["type"] == "FeatureCollection" else g.get("geometry", g)

def polygons(geom):
    if geom["type"] == "Polygon":
        yield geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        yield from geom["coordinates"]

def raster_land(geom, project, W, H):
    """project(lon, lat) -> (x, y) pixels. Exterior rings filled, holes cleared."""
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for poly in polygons(geom):
        ext = [project(lo, la) for lo, la in poly[0]]
        d.polygon(ext, fill=255)
        for hole in poly[1:]:
            d.polygon([project(lo, la) for lo, la in hole], fill=0)
    return np.asarray(img) > 127


def unwrap_ring(ring):
    """Make longitudes continuous across the antimeridian. Returns (points, winding) where
    winding is the net longitude travelled / 360 (nonzero for rings that encircle a pole)."""
    out = [(ring[0][0], ring[0][1])]
    off = 0.0
    for (lo0, _), (lo1, la1) in zip(ring, ring[1:]):
        d = lo1 - lo0
        if d > 180: off -= 360.0
        elif d < -180: off += 360.0
        out.append((lo1 + off, la1))
    winding = round((out[-1][0] - out[0][0]) / 360.0)
    return out, winding

def ring_variants(ring):
    """Yield closed point lists in lon/lat space (lon may exceed +-180) that tile the seam.
    Polar rings are closed through the pole. Degenerate/pole-only rings are skipped."""
    if all(abs(p[1]) > 89.9 for p in ring):
        return
    pts, winding = unwrap_ring(ring)
    if winding != 0:
        pole = -90.0 if sum(p[1] for p in pts) / len(pts) < 0 else 90.0
        pts = pts + [(pts[-1][0], pole), (pts[0][0], pole)]
    for shift in (-720, -360, 0, 360, 720):
        yield [(lo + shift, la) for lo, la in pts], winding != 0

def raster_land_seam(geom, project, W, H):
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for poly in polygons(geom):
        for k, ring in enumerate(poly):
            for pts, _polar in ring_variants(ring):
                xs = [p[0] for p in pts]
                if max(xs) < -180 or min(xs) > 180:
                    continue
                d.polygon([project(lo, la) for lo, la in pts], fill=255 if k == 0 else 0)
    return np.asarray(img) > 127
