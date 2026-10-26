# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0", "skia-pathops==0.9.2"]
# ///
"""Export selected Noto CJK forms. Run with uv; source TTC paths are arguments."""
import hashlib, json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen, replayRecording
from fontTools.pens.basePen import BasePen
from fontTools.pens.cu2quPen import Cu2QuPen
import pathops

class Contours(BasePen):
    def __init__(self):
        super().__init__(None)
        self.result = []
    def _moveTo(self, p):
        self.ops, self.points = 'M', list(p)
    def _lineTo(self, p):
        self.ops += 'L'; self.points.extend(p)
    def _qCurveToOne(self, a, b):
        self.ops += 'Q2'; self.points.extend((*a, *b))
    def _closePath(self):
        self.result.append([self.ops, [round(x, 2) for x in self.points]])
    def _endPath(self):
        self._closePath()

def contours(gs, name):
    pen = RecordingPen(); gs[name].draw(pen)
    result, current = [], []
    for command in pen.value:
        current.append(command)
        if command[0] in ('closePath', 'endPath'):
            result.append(current); current = []
    return result

def clipped(recording, box):
    p, q = pathops.Path(), pathops.Path()
    replayRecording(recording, p.getPen())
    x0,y0,x1,y1 = box
    q.moveTo(x0,y0); q.lineTo(x1,y0); q.lineTo(x1,y1); q.lineTo(x0,y1); q.close()
    out = RecordingPen()
    pathops.op(p,q,pathops.PathOp.INTERSECTION).draw(out)
    return out.value

def group(cs):
    pen = Contours()
    for c in cs: replayRecording(c, Cu2QuPen(pen, 0.5))
    return pen.result

hashes = {'sans':'b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a', 'serif':'93069d8e9e45d515cc421c971a79e6a5777704b348e36a9ef86578bf58adef77'}
result = {'license':'SIL OFL 1.1', 'sources':{}, 'forms':{}}
for style, filename in zip(('sans','serif'), sys.argv[1:], strict=True):
    path = Path(filename)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    if sha != hashes[style]: raise ValueError('Unexpected source font hash: '+style)
    font = TTFont(path,fontNumber=0); gs=font.getGlyphSet(); cmap=font.getBestCmap()
    # U+FA5B and 者 + VS18 resolve to the same native dotted glyph in both pinned fonts.
    dotted = next(g for t in font['cmap'].tables if t.format == 14 for c,g in t.uvsDict[0xE0101] if c == 0x8005)
    assert dotted == cmap[0xFA5B]
    cs=lambda ch:contours(gs,cmap[ord(ch)])
    forms={}
    if style=='sans':
        c=cs('氺'); dots=[group([c[0],c[2]]),group([c[3]]),group([c[1]])]
        c=cs('彀'); roof=clipped(c[3],(0,400,491,594))
        forms['⿳士冖一']=[group([c[2]]),group([roof]),group([c[0]])]
    else:
        # Detach the upper-right dot where its upper edge meets 田 (818,475 -> 756,444).
        c=cs('塁'); dots=[group([c[0],c[2]]),group([c[5][:2] + c[5][14:]]),group([c[1]])]
        c=cs('彀'); forms['⿳士冖一']=[group([c[2]]),group([c[1]]),group([c[0]])]
    forms['⿰冫⿱丿丶']=dots
    forms['⿰冫⿾冫']=[dots[0],dots[1]+dots[2]]
    for sequence,ch in [('⿱宀儿','宂'),('⿻三丨','丰'),('⿻者丶','者')]:
        forms[sequence]=[group(cs(ch))]
    # These exact source descriptions have native JP glyphs, including their middle dots.
    for ch,bottom in [('塁','土'),('疂','冝')]:
        for dots_seq in ['⿰冫⿱丿丶','⿰冫⿾冫']:
            forms['⿳田'+dots_seq+bottom]=[group(cs(ch))]
    result['forms'][style]=forms
    result['sources'][style]={'name':font['name'].getDebugName(4),'version':font['name'].getDebugName(5),'sha256':sha,'face':0}
Path('src/composer/component-forms.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
