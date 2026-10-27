# Build from the verified HTTP cache populated by audit_render_coverage.mjs.
# python3 scripts/build_host_glyph_coverage.py CACHE_DIR
import json,gzip,hashlib,sys
from pathlib import Path
base='https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5+letters/'
cache=Path(sys.argv[1])
hashes={}; points=set()
for name in ['manifest.json']+[f'g/{i:03x}.json' for i in range(4096)]:
 p=cache/hashlib.sha256((base+name).encode()).hexdigest()
 raw=p.read_bytes();hashes[name]=hashlib.sha256(raw).hexdigest()
 data=json.loads(gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw)
 if name=='manifest.json':continue
 for record in data.values():
  k=record.get('k','');g=record.get('G')
  if len(k)==1 and g and g.get('p'):points.add(ord(k))
ranges=[]
for cp in sorted(points):
 if ranges and cp==ranges[-1][1]+1:ranges[-1][1]=cp
 else:ranges.append([cp,cp])
(Path(__file__).resolve().parents[1]/'data/host-glyph-coverage.json').write_text(json.dumps({'base':base,'scope':'Single-scalar records with direct outlines in the pinned default export; excludes composed or host-cut results.','count':len(points),'ranges':ranges,'sha256':hashes},separators=(',',':'))+'\n')
print(len(points),'host glyphs')
