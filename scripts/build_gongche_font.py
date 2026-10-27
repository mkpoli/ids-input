# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Bundle the encoded Gongche forms missing from the palette's font subsets."""
from pathlib import Path
from tempfile import TemporaryDirectory
from fontTools import subset
from fontTools.ttLib import TTFont
from build_ids_data import fetch
from build_ids_parts import FONTS

CHARACTERS = '𢒼𪛗𪛘𪛙𪛚𪛛𪛜𪛝'

if __name__ == '__main__':
    with TemporaryDirectory() as temp:
        url, digest = FONTS['PlangothicP1-Regular.ttf']
        source = fetch(url, Path(temp) / 'PlangothicP1-Regular.ttf', digest)
        font = TTFont(source, recalcTimestamp=False)
        missing = set(map(ord, CHARACTERS)) - font.getBestCmap().keys()
        if missing:
            raise ValueError(f'Missing Gongche glyphs: {sorted(missing)}')
        options = subset.Options()
        options.recalc_timestamp = False
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(text=CHARACTERS)
        sub.subset(font)
        font.flavor = 'woff2'
        font.save(Path(__file__).resolve().parents[1] / 'fonts/Plangothic-gongche.woff2')
