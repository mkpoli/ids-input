# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build the bundled Tangut WOFF2: uv run scripts/build_tangut_font.py."""
from pathlib import Path
from tempfile import TemporaryDirectory
from fontTools.ttLib import TTFont
from build_ids_data import fetch

URL = 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/unhinted/ttf/NotoSerifTangut/NotoSerifTangut-Regular.ttf'
SHA256 = '788a67394f60f7cf1bd6f08aa3ac5d933e2612e82816a6ba718050724e32659e'
with TemporaryDirectory() as temp:
    source = fetch(URL, Path(temp) / 'Tangut.ttf', SHA256)
    font = TTFont(source)
    font.recalcTimestamp = False
    font.flavor = 'woff2'
    font.save(Path(__file__).resolve().parents[1] / 'fonts/NotoSerifTangut-Regular.woff2')
