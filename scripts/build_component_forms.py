# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0", "skia-pathops==0.9.2"]
# ///
"""Export selected Noto CJK forms. Run with uv; source TTC paths are arguments."""
import hashlib, json, sys
import pathops
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen, replayRecording
from fontTools.pens.basePen import BasePen
from fontTools.pens.cu2quPen import Cu2QuPen

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

def crop_group(cs, box):
    shape, rect = pathops.Path(), pathops.Path()
    for c in cs: replayRecording(c, shape.getPen())
    x0, y0, x1, y1 = box
    rect.moveTo(x0, y0); rect.lineTo(x1, y0); rect.lineTo(x1, y1); rect.lineTo(x0, y1); rect.close()
    pen = RecordingPen()
    pathops.op(shape, rect, pathops.PathOp.INTERSECTION).draw(pen)
    return group([pen.value])

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
    # Repeat the same native water radical, avoiding contextual host selection
    # that gives the two columns different proportions or overlapping strokes.
    water=group(cs('氵'))
    dx=450 if style=='sans' else 480
    water_right=[[ops,[v+dx if i%2==0 else v for i,v in enumerate(points)]] for ops,points in water]
    forms['⿰氵氵']=[water,water_right]
    # Gongche's three sweeps above a vertical: extend 彳 with one more
    # native upper sweep. Translate the sweeps without thinning their strokes;
    # shorten only the vertical stem to keep the original baseline and em.
    c=cs('彳')
    sweep=group([c[0]])
    step=180 if style=='sans' else 200
    second=[[ops,[v if i%2==0 else v-step for i,v in enumerate(points)]] for ops,points in sweep]
    lower=group([c[1]])
    lower=[[ops,[v if i%2==0 or v<0 else v-step for i,v in enumerate(points)]] for ops,points in lower]
    forms['⿱𰀪亻']=[sweep+second,lower]
    if style=='sans':
        c=cs('氺'); dots=[group([c[0],c[2]]),group([c[3]]),group([c[1]])]
        c=cs('壱'); crown=[group([c[1]]),group([c[0]])]
        bar=group([cs('壹')[0]])
    else:
        # Detach the upper-right dot where its upper edge meets 田 (818,475 -> 756,444).
        c=cs('塁'); dots=[group([c[0],c[2]]),group([c[5][:2] + c[5][14:]]),group([c[1]])]
        c=cs('壱'); crown=[group([c[0]]),group([c[1]])]
        bar=group([cs('壹')[1]])
    # Compose the intact 士冖 crown above a short 一, with unchanged stroke weight.
    # The line is translated only; both pieces retain their native horizontal proportions.
    ys=[v for _,points in bar for v in points[1::2]]
    dy=200-(min(ys)+max(ys))/2
    bar=[[ops,[v if i%2==0 else v+dy for i,v in enumerate(points)]] for ops,points in bar]
    # The 文-shaped shared enclosure of 彥/產, without 產's 生.
    # Native contours preserve the crossing strokes and the long 厂 descender.
    c=cs('產')
    yan=group([c[0],c[1],c[2]] if style=='sans' else [c[0],c[2]])
    forms['⿳亠㐅厂']=[yan]
    forms['⿱文厂']=[yan]
    # Keep the 立-shaped form as literal IDS even though 产 has a code point.
    forms['⿳亠丷厂']=[group(cs('产'))]
    # Requested reusable parts, cut from native host glyphs at their original em.
    c=cs('畿')
    if style=='sans':
        # Bypass the connected 田 outline; retain 戈's falling stroke.
        outside=c[0][:40]+[('lineTo', ((408,-29),))]+c[0][47:]
        forms['⿻𢆶戈']=[group([outside,c[5]])]
    else:
        forms['⿻𢆶戈']=[group(c[5:])]
    c=cs('屐')
    forms['⿸尸彳']=[group([c[i] for i in ([0,1] if style=='sans' else [0,1,2,5])])]
    c=cs('鹿')
    forms['㇯鹿比']=[group(c[:6] if style=='sans' else c[:4])]
    # 灬 consists of the first four independent contours in both source fonts.
    for ch in ['馬','鳥']:
        forms['㇯'+ch+'灬']=[group(cs(ch)[4:])]
    c=cs('亭')
    forms['⿳亠口冖']=[group(c[:4] if style=='sans' else [c[0],c[2],c[3],c[4]])]
    # TC supplies the 氺 form of 犀 and the four-stroke 卝 in 夢.
    tc=TTFont(path,fontNumber=3); tcgs=tc.getGlyphSet(); tccmap=tc.getBestCmap()
    tcs=lambda ch:contours(tcgs,tccmap[ord(ch)])
    c=tcs('犀')
    forms['⿸尸氺']=[group(c[:7] if style=='sans' else [c[0],c[1],c[3],c[4]])]
    c=cs('橐')
    if style=='sans':
        wood=c[1][:16]+[('lineTo', ((460,233),))]+c[1][30:]
        forms['⿳𰀉冖木']=[group([c[2],c[3],c[4],wood])]
    else:
        wood=[('moveTo', ((468,237),))]+c[3][13:36]+[('closePath', ())]
        forms['⿳𰀉冖木']=[group([c[0],c[1],c[2],wood])]
    c=tcs('夢')
    if style=='sans':
        forms['⿳卝罒冖']=[group(c[:7])]
    else:
        cover=group([cs('亭')[4]])
        cover=[[ops,[v if i%2==0 else v-70 for i,v in enumerate(points)]] for ops,points in cover]
        forms['⿳卝罒冖']=[group([c[0],c[1],c[3],c[4],c[5],c[6]])+cover]
    forms['⿱士冖']=crown
    forms['⿳士冖一']=crown+[bar]
    forms['⿱⿱士冖一']=crown+[bar]
    # 興's upper component: preserve the open top of 𦥑 and remove 一八 below.
    # Crop the outer frame at the native baseline; keep 同's counters intact.
    c=cs('興')
    if style=='sans':
        forms['⿴𦥑同']=[crop_group([c[5],c[7]], (0,222,1000,880)),group([c[0],c[1],c[2],c[6]])]
    else:
        # Drop the bottom 一's terminal before clipping: its tip rises above y=197.
        outer=[('moveTo', ((854,197),))]+c[3][7:]
        forms['⿴𦥑同']=[crop_group([outer,c[7]], (0,197,1000,880)),group([c[0],c[4],c[5],c[6]])]
    # The connected-stroke regional 卑 (also U+FA35), without its bottom 十.
    # Keep its native em, including the downward stroke emerging from 日.
    c=cs('卑')
    if style=='sans':
        upper=[('moveTo', ((250,179),))]+c[4][13:]
        forms['⿱㇒⿻日丿']=[group(c[:4]+[upper])]
    else:
        forms['⿱㇒⿻日丿']=[group(c[1:])]
    # Two short 二 columns: contract horizontal length only, preserving native
    # stroke thickness. Translate each bar to its row instead of stretching it.
    bars=group(cs('二'))
    bars.sort(key=lambda c: max(c[1][1::2]), reverse=True)
    columns=[]
    for center in [300,700]:
        column=[]
        for row,(ops,points) in enumerate(bars):
            ys=points[1::2]; dy=(550 if row==0 else 330)-(min(ys)+max(ys))/2
            column.append([ops, [round(center+(v-500)*0.32,2) if i%2==0 else round(v+dy,2) for i,v in enumerate(points)]])
        columns.append(column)
    forms['⿰二二']=columns
    # ⿱丿乚 / ⿱㇒乚: retain 毛's shallow sweep and hooked stem, removing
    # its two intervening bars. Split at the original junction so both strokes
    # stay independently editable without a gap or a change in stroke weight.
    c=cs('毛')[0]
    if style=='sans':
        sweep=[('moveTo', ((477,678),))]+c[20:25]+[('closePath', ())]
        hook=[('moveTo', ((400,663),)),('lineTo', ((400,77),))]+c[4:11]+[('lineTo', ((477,678),)),('closePath', ())]
    else:
        sweep=[('moveTo', ((490,687),))]+c[5:11]+[('closePath', ())]
        hook=[('moveTo', ((422,674),)),('lineTo', ((422,41),))]+c[20:31]+[('lineTo', ((490,687),)),('closePath', ())]
    forms['⿱丿乚']=[group([sweep]),group([hook])]
    forms['⿱㇒乚']=forms['⿱丿乚']

    forms['⿰冫⿱丿丶']=dots
    forms['⿰冫⿾冫']=[dots[0],dots[1]+dots[2]]
    for sequence,ch in [('⿱宀儿','宂'),('⿻三丨','丰'),('⿻者丶','者')]:
        forms[sequence]=[group(cs(ch))]
    # These exact source descriptions have native JP glyphs, including their middle dots.
    for ch,bottom in [('塁','土'),('疂','冝')]:
        for dots_seq in ['⿰冫⿱丿丶','⿰冫⿾冫']:
            forms['⿳田'+dots_seq+bottom]=[group(cs(ch))]
    result['forms'][style]=forms
    result['sources'][style]={'name':font['name'].getDebugName(4),'version':font['name'].getDebugName(5),'sha256':sha,'face':0,
        'additionalFaces':[{'face':3,'name':tc['name'].getDebugName(4),'forms':['⿸尸氺','⿳卝罒冖']}]}
Path('src/composer/component-forms.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
