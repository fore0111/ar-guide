"""OpenStreetMap（Overpass API の JSON）から data/buildings.json を生成する。
取得例: curl https://overpass-api.de/api/interpreter --data-urlencode
  'data=[out:json];(way["building"](37.4215,138.7755,37.4285,138.7815););out tags geom;' -o osm.json
使い方: python3 tools/build_buildings.py osm.json
"""
import json, os, sys
d = json.load(open(sys.argv[1]))
out = []
for e in d['elements']:
    g = e.get('geometry')
    if e['type'] != 'way' or not g:
        continue
    ring = [[round(p['lat'], 6), round(p['lon'], 6)] for p in g]
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    lat = sum(p[0] for p in pts) / len(pts)
    lon = sum(p[1] for p in pts) / len(pts)
    out.append({'id': e['id'], 'name': e.get('tags', {}).get('name', ''), 'lat': round(lat, 6), 'lon': round(lon, 6), 'ring': pts})
path = os.path.join(os.path.dirname(__file__), '..', 'data', 'buildings.json')
json.dump({'source': '© OpenStreetMap contributors (ODbL)', 'buildings': out}, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), os.path.getsize(path))
