# Regenerating public/earth-map*.webp
Source data: Natural Earth 50m land + country borders (public domain) via the `world-atlas@2` npm package.
1. npm i world-atlas@2 topojson-client@3 (in a scratch dir, NOT a Sutra dependency)
2. node topo2geo.cjs <scratch-dir> <out-dir>        # writes land.geojson, borders.geojson
3. Edit OUT in build_texture.py, then: python3 build_texture.py   # needs numpy + Pillow
Output is a 4096x2048 equirectangular map (lon -180..180, lat 90..-90).
Rings crossing the antimeridian (Chukotka, Antarctica) are unwrapped in geo.py.
