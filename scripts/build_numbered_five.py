# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Replace the Sans {5} cut with the native component in 遐.

Run with the Noto Sans CJK JP 2.004 collection and its JP face index:
    uv run scripts/build_numbered_five.py /path/to/NotoSansCJK-Regular.ttc --font-number 0
"""
import argparse
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen, replayRecording
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

from build_tangut_outlines import Contours

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('font', type=Path)
parser.add_argument('--font-number', type=int, default=0)
args = parser.parse_args()
font = TTFont(args.font, fontNumber=args.font_number)
if '2.004' not in (font['name'].getDebugName(5) or '') or font['head'].unitsPerEm != 1000:
    raise ValueError('Expected Noto Sans CJK JP 2.004 with 1000 units per em')
glyphs = font.getGlyphSet()
recording = RecordingPen()
glyphs[font.getBestCmap()[ord('遐')]].draw(recording)
contours, current = [], []
for command, points in recording.value:
    current.append((command, points))
    if command in ('closePath', 'endPath'):
        bounds = BoundsPen(glyphs)
        replayRecording(current, bounds)
        if bounds.bounds in ((325, 66, 607, 807), (395, 600, 535, 746)):
            contours.append(current)
        current = []
if len(contours) != 2:
    raise ValueError('The expected 遐 contours were not found')
# Translation centres the cut in the em. Its dimensions and stroke widths remain native.
pen = Contours(glyphs, 1)
for contour in contours:
    replayRecording(contour, TransformPen(Cu2QuPen(pen, max_err=0.5), (1, 0, 0, 1, 34, 0)))
record = {'v': 0, 'b': [359, 66, 641, 807], 'p': pen.contours}
# Keep ink as the native perimeter, matching bundled glyph records.
from fontTools.pens.perimeterPen import PerimeterPen
perimeter = PerimeterPen(glyphs)
for contour in contours:
    replayRecording(contour, perimeter)
result = {'source': 'Noto Sans CJK JP 2.004, 遐', 'license': 'SIL OFL 1.1', 'G': record, 'ink': round(perimeter.value, 4)}
(ROOT / 'data/numbered-five-context.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
