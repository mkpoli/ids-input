# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0", "skia-pathops==0.9.2", "brotli==1.2.0"]
# ///
"""Export contextual forms from pinned Noto TTCs and the bundled Kureedo WOFF2.

Run with uv; arguments are Noto Sans CJK and Noto Serif CJK Regular TTC paths.
"""
import hashlib, json, sys
import pathops
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen, replayRecording
from fontTools.pens.basePen import BasePen
from fontTools.pens.cu2quPen import Cu2QuPen
from xie_forms import xie_noto, register as register_xie, PROVENANCE as XIE_PROVENANCE
from biang_forms import IDS as BIANG_IDS, biang_noto

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

def compress_chang(outlines, style):
    """Shorten 菖's 昌 by contracting counters and gaps more than its bars."""
    if style == 'sans':
        source = [-82,-43,16,93,148,222,281,338,390,456,505,570,622]
        heights = [12,38,26,36,26,38,24,36,26,36,26,38]
    else:
        source = [-76,-18,12,115,145,241,271,308,352,381,466,496,578,608,645]
        heights = [18,22,38,22,38,22,14,24,22,38,22,38,22,24]
    target = [-59]
    for height in heights: target.append(target[-1] + height)
    def ymap(y):
        i = next((i for i in range(len(source)-1) if y <= source[i+1]), len(source)-2)
        return round(target[i] + (y-source[i]) * (target[i+1]-target[i]) / (source[i+1]-source[i]), 2)
    return [[ops, [ymap(v) if i % 2 else v for i,v in enumerate(points)]] for ops,points in outlines]

hashes = {'sans':'b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a', 'serif':'93069d8e9e45d515cc421c971a79e6a5777704b348e36a9ef86578bf58adef77'}
result = {'license':'SIL OFL 1.1', 'sources':{}, 'forms':{}, 'positions':{}}
genzui_path = Path('fonts/GenZuiSans-Regular.woff2')
genzui_sha = hashlib.sha256(genzui_path.read_bytes()).hexdigest()
if genzui_sha != 'efb3b0bf65f178b52ede78a552cf7d642d1c9bbd47c3fbddf860d70ec92d7f7a':
    raise ValueError('Unexpected GenZui source hash')
genzui = TTFont(genzui_path)
genzui_gs, genzui_cmap = genzui.getGlyphSet(), genzui.getBestCmap()
genzui_cs = lambda ch: contours(genzui_gs, genzui_cmap[ord(ch)])
zhan_legs = group([genzui_cs('詹')[4], genzui_cs('詹')[5]])
result['sources']['genzui'] = {
    'name': genzui['name'].getDebugName(4), 'version': genzui['name'].getDebugName(5),
    'sha256': genzui_sha, 'license': 'SIL OFL 1.1',
}
for style, filename in zip(('sans','serif'), sys.argv[1:], strict=True):
    path = Path(filename)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    if sha != hashes[style]: raise ValueError('Unexpected source font hash: '+style)
    font = TTFont(path,fontNumber=0); gs=font.getGlyphSet(); cmap=font.getBestCmap()
    # U+FA5B and 者 + VS18 resolve to the same native dotted glyph in both pinned fonts.
    dotted = next(g for t in font['cmap'].tables if t.format == 14 for c,g in t.uvsDict[0xE0101] if c == 0x8005)
    assert dotted == cmap[0xFA5B]
    cs=lambda ch:contours(gs,cmap[ord(ch)])
    # Native left-side 朱 from 鴸 and the two legs joined to 元's lower bar.
    # The latter is clipped at the bar's underside for attachment to another bar.
    result['positions'][style] = {
        '朱:L': group([cs('鴸')[4]]),
        '儿:under-bar': crop_group(cs('元')[1:], (-100,-120,1100,408 if style=='sans' else 475)),
        # The legs under 厃 in 詹, cut from the 詹 glyph itself.
        '儿:zhan': zhan_legs,
        '儿:dan': group([genzui_cs('擔')[3], genzui_cs('擔')[12]]),
        # Contract the already-shortened native 昌 while retaining its bars.
        '昌:stack': compress_chang(group(cs('菖')[:6] if style=='sans' else cs('菖')[1:]), style),
    }
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
    # Whole glyphs retain the font designer's placement and stroke weights for
    # the common enclosed forms, including when nested in a larger IDS.
    for enclosure, examples in [('⿳亠㐅厂', [('彡','彥'), ('生','產')]),
                                ('⿱文厂', [('彡','彥'), ('生','產')])]:
        for inner, ch in examples:
            forms['⿸'+enclosure+inner]=[group(cs(ch))]
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
    # Retain 萬's complete outer contour, removing only the 禸 interior.
    # 両 supplies 山, fitted inside the original enclosure and joined at its roof.
    wan = cs('萬')
    if style == 'sans':
        outer = [('moveTo', ((534, 208),))] + wan[4][4:25] + [('closePath', ())]
        shell_contours = wan[:4] + [outer, wan[5]]
        source_bottom, source_top, target_bottom, target_top = 16, 339, 25, 208
        gap_bottom, gap_top, dx = 135, 285, -120
    else:
        outer = [('moveTo', ((535, 240),))] + wan[5][5:42] + [('closePath', ())]
        shell_contours = wan[:5] + [outer]
        source_bottom, source_top, target_bottom, target_top = 39, 376, 32, 240
        gap_bottom, gap_top, dx = 131, 289, -110
    # Any difference from 萬 must remain inside the lower interior.
    original, edited, region = pathops.Path(), pathops.Path(), pathops.Path()
    for contour in wan: replayRecording(contour, original.getPen())
    for contour in shell_contours: replayRecording(contour, edited.getPen())
    region.moveTo(200, -20); region.lineTo(800, -20); region.lineTo(800, target_top)
    region.lineTo(200, target_top); region.close()
    difference = pathops.op(original, edited, pathops.PathOp.XOR)
    assert pathops.op(difference, region, pathops.PathOp.DIFFERENCE).area < 0.1
    # 満's contextual 両 has a shorter 山. Shorten only the straight
    # upright runs between its bottom bar and upper terminals; keep all
    # terminals and the bar at their native weight and shape.
    mountain = crop_group(cs('満'), (430, source_bottom, 810, source_top))
    reduction = (source_top - source_bottom) - (target_top - target_bottom)
    def mountain_y(y):
        if y <= gap_bottom: return y + target_bottom - source_bottom
        if y >= gap_top: return y + target_bottom - source_bottom - reduction
        return gap_bottom + target_bottom - source_bottom + (y-gap_bottom) * (gap_top-gap_bottom-reduction) / (gap_top-gap_bottom)
    mountain = [[ops, [round(mountain_y(v), 2) if i % 2 else v + dx for i, v in enumerate(points)]] for ops, points in mountain]
    # Check the final union too, including containment of the inserted contours.
    mountain_path = pathops.Path()
    pen = mountain_path.getPen()
    import re
    for ops, points in mountain:
        coords = iter(points)
        for op in re.findall(r'M|L|Q2', ops):
            if op == 'M': pen.moveTo((next(coords), next(coords)))
            elif op == 'L': pen.lineTo((next(coords), next(coords)))
            else: pen.qCurveTo((next(coords), next(coords)), (next(coords), next(coords)))
        pen.closePath()
    assert pathops.op(mountain_path, region, pathops.PathOp.DIFFERENCE).area < 0.1
    combined = pathops.op(edited, mountain_path, pathops.PathOp.UNION)
    difference = pathops.op(original, combined, pathops.PathOp.XOR)
    assert pathops.op(difference, region, pathops.PathOp.DIFFERENCE).area < 0.1
    forms['⿳艹田⿵冂山'] = [group(shell_contours), mountain]
    # The expanded U+30EDE description retains its native enclosure and eleven
    # editable leaves, including the junctions between neighboring components.
    biang = biang_noto(cs, style)
    original, partitioned = pathops.Path(), pathops.Path()
    for contour in cs('𰻞'):
        replayRecording(contour, original.getPen())
    for part in biang:
        for contour in part:
            replayRecording(contour, partitioned.getPen())
    assert len(biang) == 11
    assert pathops.op(original, partitioned, pathops.PathOp.XOR).area < 0.1, 'Biang leaf cuts changed the native outline'
    forms[BIANG_IDS] = [group(part) for part in biang]
    register_xie(forms, [group(part) for part in xie_noto(cs, style)])
    result['forms'][style]=forms
    result['sources'][style]={'name':font['name'].getDebugName(4),'version':font['name'].getDebugName(5),'sha256':sha,'face':0,
        'additionalFaces':[{'face':3,'name':tc['name'].getDebugName(4),'forms':['⿸尸氺','⿳卝罒冖']}]}
# The brush variant uses its own native donor font; no Noto fallback is bundled.
from xie_kaisho import xie_kaisho
brush_path = Path('fonts/Kureedo-Regular.woff2')
brush_sha = hashlib.sha256(brush_path.read_bytes()).hexdigest()
if brush_sha != '678769b18123201d292436e854121de9b636162ca595e5e9fb71684636ead430':
    raise ValueError('Unexpected source font hash: kaisho')
brush = TTFont(brush_path)
result['forms']['kaisho'] = {}
register_xie(result['forms']['kaisho'], [group(part) for part in xie_kaisho(brush.getGlyphSet(), brush.getBestCmap())])
result['sources']['kaisho'] = {
    'name': brush['name'].getDebugName(4), 'version': brush['name'].getDebugName(5),
    'sha256': brush_sha, 'url': 'https://github.com/mkpoli/kureedo',
}
result['editorial'] = {'JYN00003': {**XIE_PROVENANCE, 'donors': {
    'sans': ['寫'], 'serif': ['寫'], 'kaisho': ['寫', '旧', '目'],
}}}
Path('src/composer/component-forms.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
