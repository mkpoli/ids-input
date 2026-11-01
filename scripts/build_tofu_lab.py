# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]"]
# ///
"""Cut the lab fonts `demo/check-tofu.js` uses: each Noto Sans CJK face with only the ideographs it
draws, so a browser page that overrides the family draws boxes for radicals, strokes and the
empty-slot mark unless the app's own webfonts supply them. Like a phone with no CJK font installed.

uv run scripts/build_tofu_lab.py FONT.ttc OUT_DIR
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTCollection

FAMILIES = {'0': 'jp', '1': 'kr', '2': 'sc', '3': 'tc', '4': 'hk'}


def main():
    source, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    collection = TTCollection(source)
    for number, suffix in FAMILIES.items():
        font = collection.fonts[int(number)]
        kept = 0
        for table in font['cmap'].tables:
            for code in list(table.cmap):
                if 0x3400 <= code <= 0x9FFF or 0x20000 <= code <= 0x3FFFF:
                    kept += 1
                else:
                    del table.cmap[code]
        font['name'].setName(f'Tofu Lab {number}', 1, 3, 1, 0x409)
        font['name'].setName(f'TofuLab{number}-Regular', 6, 3, 1, 0x409)
        font.flavor = 'woff2'
        target = out / f'tofu-{suffix}.woff2'
        font.save(target)
        print(target, kept, 'characters')


if __name__ == '__main__':
    main()
