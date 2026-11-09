# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0", "skia-pathops==0.9.2", "brotli==1.2.0"]
# ///
"""Export contextual forms from pinned Noto TTCs and bundled brush WOFF2s.

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

def seal_dot_top(cs, style):
    """Compose the manuscript's joined ⺊冖 from each face's 上 and 冖.

    Remove 上's baseline, then place its stem and rightward bar over the
    native cover. Each face retains its own cover width, terminals and
    stroke weights. Shorten the stem's open intervals and extend Kureedo's
    rightward bar to the cover's edge.
    """
    if style == 'sans':
        # The plain bar reaches the cover's right edge. Keep its native 75
        # unit weight; the stem below it is the longer run, as in the manuscript.
        levels = [(100, 562), (441, 725), (516, 800), (825, 860)]
        dx = 34
    elif style == 'serif':
        # Keep 上's triangular bar terminal and stem entry, and 冖's
        # asymmetric brush endings. The thin bar sits lower than Sans.
        levels = [(100, 543), (435, 697), (529, 791), (789, 810), (829, 850)]
        dx = 25
    elif style == 'kaisho':
        # Cut Kureedo 上 above its baseline (highest point 74), retaining
        # the slanted bar and stem entry; join the stem to 冖's rising roof.
        levels = [(100, 460), (399, 660), (467, 728), (703, 790), (763, 850)]
        dx = 30
    else:
        raise ValueError('Unknown KRM top style: ' + style)

    def ymap(y):
        a, b = next(((a, b) for a, b in zip(levels, levels[1:]) if y <= b[0]), levels[-2:])
        return a[1] + (y - a[0]) * (b[1] - a[1]) / (b[0] - a[0])

    def xmap(x):
        # Extend only Kureedo's rightward bar; retain the native stem width.
        if style == 'kaisho' and x > 496:
            return 526 + (x - 496) * (917 - 526) / (794 - 496)
        return x + dx

    top = crop_group(cs('上'), (-2000, 100, 3000, 2000))
    top = [[ops, [round(ymap(v) if i % 2 else xmap(v), 2)
                  for i, v in enumerate(points)]] for ops, points in top]
    return [top, group(cs('冖'))]

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



ROOF_CUT = 535         # 王's top bar in Sans: the roof lives above it
APEX_CUT = 690         # the apex of 𠆢 sits above this: cutting it opens the roof into 八

def move_recording(recordings, fn):
    """The same contours with every point passed through fn."""
    return [[(op, tuple(fn(*point) for point in args)) for op, args in recording]
            for recording in recordings]

def huang_eight(cs):
    """黄's 八: the two wide, short strokes the character ends in."""
    return [contour for contour in cs('\u9ec4')
            if max(p[1] for _, args in contour for p in args) < 120
            and max(p[0] for _, args in contour for p in args)
            - min(p[0] for _, args in contour for p in args) > 250]

def jin_with_ba(cs, style='sans'):
    """金 with its 𠆢 opened into 八.

    金's roof is two strokes that meet at the apex and come down on 王's top bar. Removing
    the apex leaves those strokes standing as 八, which is how this character shares 黄's
    last two strokes: the legs keep the weight and the angles 金 draws them with.
    """
    shape = pathops.Path()
    for contour in cs('金'): replayRecording(contour, shape.getPen())
    apex = pathops.Path()
    apex.moveTo(385, APEX_CUT); apex.lineTo(615, APEX_CUT)
    apex.lineTo(615, 1000); apex.lineTo(385, 1000); apex.close()
    pen = RecordingPen()
    pathops.op(shape, apex, pathops.PathOp.DIFFERENCE).draw(pen)
    return [group([pen.value])]

def huang_body(cs):
    """黄 without its last two strokes, which 金's top stands in for.

    黄 is ⿳龷由八; drop the 八 and the body is ⿱龷由. IDS cannot show two components
    sharing a stroke, so the example names the body and this form keeps it where 黄
    draws it, rather than letting the composer lay 龷 and 由 out afresh.
    """
    eight = huang_eight(cs)
    return [contour for contour in cs('黄') if contour not in eight]

def wan_shan(cs, style):
    if style in ('kaisho', 'fangsong'):
        return wan_shan_brush(cs, style)
    # 萬's own outline with 山 where its 禸 sits. One contour of 萬 carries the outer
    # edge, 田's box, the legs and the 禸 pencil as a single run of filled ink, so a
    # boolean cut cannot lift the pencil out. Splice it out of that contour instead:
    # the run from the right leg's inner edge round to the left leg's inner edge keeps
    # 艹, 田, the bar under 田, the legs and the hook untouched, and closing it flat
    # across the band's inner top drops the pencil. 山 uses the compartment above the hook blade.
    wan = cs('萬')
    if style == 'sans':
        # 萬's own contour order differs between the two faces.
        cao, counters, frame = wan[5:6], wan[:4], wan[4]
        inner_top, keep = (826, 208), slice(5, 25)
    else:
        cao, counters, frame = wan[0:1], wan[1:5], wan[5]
        inner_top, keep = (814, 240), slice(6, 42)
    # Reopening the contour at the band's inner top: the splice starts on the right
    # leg's inner edge and `closePath` draws the flat edge back from the left one.
    band = [('moveTo', (inner_top,))] + frame[keep] + [('closePath', ())]

    def path_of(recordings):
        path = pathops.Path()
        for recording in recordings: replayRecording(recording, path.getPen())
        return path

    # The command indices are not safe to take on trust: a slice that starts one command late
    # still closes along the band's inner top, and only nicks a leg. Compare against 萬 itself.
    native, spliced = path_of(wan), path_of([band] + cao + counters)
    assert pathops.op(spliced, native, pathops.PathOp.DIFFERENCE).area < 0.1, 'The 萬 splice draws outside 萬'
    removed = pathops.op(native, spliced, pathops.PathOp.DIFFERENCE)
    assert removed.area > 1000, 'The 萬 splice removes no 禸 pencil'
    assert removed.bounds[3] <= inner_top[1] + 0.1, 'The 萬 splice reaches above the band inner top'

    if style == 'sans':
        # Reproduce the merged band-derived construction: 72-unit uprights, a
        # 65-unit bar (the ceiling's weight), and 444/644 of the opening's width.
        # Feet clear the hook blade by 16; the stem overlaps only the ceiling.
        vertices = [(648,178),(648,105),(534,105),(534,232),
                    (462,232),(462,105),(348,105),(348,178),
                    (276,178),(276,0),(348,0),(348,40),
                    (648,40),(648,0),(720,0),(720,178)]
        shan = [[('moveTo', (vertices[0],))] +
                [('lineTo', (p,)) for p in vertices[1:]] + [('closePath', ())]]
    else:
        # 岡 supplies an enclosure-sized 山 with a native 29-unit horizontal,
        # matching 萬's ceiling. Keep its curved feet and slanted arm entries;
        # shorten the straight runs between them, never scale the bar thinner.
        # The full width is 69% of the opening, centred on 田's counter gap.
        donor = cs('岡')[2]
        assert donor[6] == ('lineTo', ((337,167),))
        assert donor[21] == ('lineTo', ((655,167),))
        levels = [(53,24),(91,62),(138,80),(167,109),(362,177),(395,210)]
        def ymap(y):
            a,b = next(((a,b) for a,b in zip(levels,levels[1:]) if y <= b[0]), levels[-2:])
            return a[1] + (y-a[0])*(b[1]-a[1])/(b[0]-a[0])
        def mapped(command):
            op, points = command
            return op, tuple((503.5+(x-512)*0.92, ymap(y)) for x,y in points)
        shan = [[('moveTo', ((535,109),)), ('lineTo', ((535,254),)),
                 ('lineTo', ((472,254),)), ('lineTo', ((472,109),))] +
                [mapped(command) for command in donor[6:22]] + [('closePath', ())]]

    # Only the stem may meet 萬, in the ceiling directly below 田's counter gap.
    overlap = pathops.op(path_of(shan), spliced, pathops.PathOp.INTERSECTION)
    spine = (462,534) if style == 'sans' else (472,535)
    top = 232 if style == 'sans' else 254
    allowed = pathops.Path()
    allowed.moveTo(spine[0], inner_top[1]); allowed.lineTo(spine[1], inner_top[1])
    allowed.lineTo(spine[1], top); allowed.lineTo(spine[0], top); allowed.close()
    assert overlap.area > 0, '山 stem does not join the ceiling'
    assert pathops.op(overlap, allowed, pathops.PathOp.DIFFERENCE).area < 0.1, '山 runs into 萬 outside the stem'
    # 田 over 冂 around 山: the same band with 艹 left out, for a description whose 金
    # bottom already draws the stroke 艹 would.
    globals().setdefault('WAN_WITHOUT_CAO', [group([band] + counters), group(shan)])
    return [group([band] + cao + counters), group(shan)]

def wan_shan_brush(cs, style):
    """Keep each face's sloping ceiling, splice out 禸, and shorten 岡's 山.

    Donor horizontals and curved feet retain their vertical weight. Only the
    open upright runs contract; the new stem follows 田's counter-gap column.
    """
    wan = cs('萬')
    donor = cs('岡')[1]
    if style == 'kaisho':
        frame = wan[1]
        assert frame[47] == ('lineTo', ((463, 214),))
        assert frame[65] == ('lineTo', ((510, 216),))
        band = frame[:48] + [frame[65], ('closePath', ())]
        retained = wan[:1] + wan[2:]
        def mapped(command):
            op, points = command
            return op, tuple((x - 8, y - 60 if y <= 187 else 127 + (y - 187) * 58 / 188) for x, y in points)
        shan = [mapped(c) for c in donor[:11]] + [
            ('lineTo', ((510, 238),)), ('lineTo', ((464, 236),)),
        ] + [mapped(c) for c in donor[32:]]
        ceiling = [(463, 214), (510, 216), (510, 238), (464, 236)]
        removed_top = 216
    elif style == 'fangsong':
        frame = wan[0]
        assert frame[11] == ('lineTo', ((520, 184),))
        assert frame[35] == ('qCurveTo', ((471, 153), (471, 181)))
        band = frame[:12] + [('lineTo', ((471, 181),))] + frame[36:]
        retained = wan[1:]
        def mapped(command):
            op, points = command
            return op, tuple((x, y - 28 if y <= 156 else 128 + (y - 156) * 42 / 184) for x, y in points)
        shan = [mapped(c) for c in donor[:21]] + [
            ('lineTo', ((471, 202),)), ('lineTo', ((522, 205),)),
        ] + [mapped(c) for c in donor[52:]]
        ceiling = [(471, 180), (522, 180), (522, 205), (471, 205)]
        removed_top = 184
    else:
        raise ValueError('Unknown brush style: ' + style)

    def path_of(recordings):
        path = pathops.Path()
        for recording in recordings:
            replayRecording(recording, path.getPen())
        return path

    native, spliced = path_of(wan), path_of([band] + retained)
    assert pathops.op(spliced, native, pathops.PathOp.DIFFERENCE).area < 0.1
    removed = pathops.op(native, spliced, pathops.PathOp.DIFFERENCE)
    assert removed.area > 1000
    assert removed.bounds[3] <= removed_top + 0.1
    allowed = path_of([[('moveTo', (ceiling[0],))] +
                       [('lineTo', (p,)) for p in ceiling[1:]] + [('closePath', ())]])
    overlap = pathops.op(path_of([shan]), spliced, pathops.PathOp.INTERSECTION)
    assert overlap.area > 0, '山 stem does not join the ceiling'
    assert pathops.op(overlap, allowed, pathops.PathOp.DIFFERENCE).area < 0.1, '山 touches the legs, blade or ceiling outside its stem'
    return [group([band] + retained), group([shan])]

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
    forms['⿳艹田⿵冂山'] = wan_shan(cs, style)
    forms['⿱田⿵冂山'] = globals()['WAN_WITHOUT_CAO']
    forms['⿱龷由'] = [group(huang_body(cs))]
    forms['⿱⿰丿㇏⿻王丷'] = jin_with_ba(cs, style)
    # The top of the KRM vulgar 處 (K07097330): ⺊'s dot as a bar, the stem centred on the cover
    # and joined to it. One component, reused as the top of ⿳⺊冖人 and its relatives.
    forms['⿱⺊冖'] = seal_dot_top(cs, style)
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
brush_gs, brush_cmap = brush.getGlyphSet(), brush.getBestCmap()
brush_cs = lambda ch: contours(brush_gs, brush_cmap[ord(ch)])
result['forms']['kaisho'] = {'⿱⺊冖': seal_dot_top(brush_cs, 'kaisho')}
result['forms']['kaisho']['⿳艹田⿵冂山'] = wan_shan(brush_cs, 'kaisho')
register_xie(result['forms']['kaisho'], [group(part) for part in xie_kaisho(brush.getGlyphSet(), brush.getBestCmap())])
result['sources']['kaisho'] = {
    'name': brush['name'].getDebugName(4), 'version': brush['name'].getDebugName(5),
    'sha256': brush_sha, 'url': 'https://github.com/mkpoli/kureedo',
}
fangsong_path = Path('fonts/ZhuqueFangsong-Regular.woff2')
fangsong_sha = hashlib.sha256(fangsong_path.read_bytes()).hexdigest()
if fangsong_sha != '5cb9aca8a85825a204ba58c9e975d8298e7370494b845694ee8a6882d0d6ed37':
    raise ValueError('Unexpected source font hash: fangsong')
fangsong = TTFont(fangsong_path)
fangsong_gs, fangsong_cmap = fangsong.getGlyphSet(), fangsong.getBestCmap()
fangsong_cs = lambda ch: contours(fangsong_gs, fangsong_cmap[ord(ch)])
result['forms']['fangsong'] = {'⿳艹田⿵冂山': wan_shan(fangsong_cs, 'fangsong')}
result['sources']['fangsong'] = {
    'name': fangsong['name'].getDebugName(4), 'version': fangsong['name'].getDebugName(5),
    'sha256': fangsong_sha,
}
result['editorial'] = {
    'JYN00003': {**XIE_PROVENANCE, 'donors': {
        'sans': ['寫'], 'serif': ['寫'], 'kaisho': ['寫', '旧', '目'],
    }},
    'KRM-07097330': {
        'kind': 'editorial manuscript-informed donor composition',
        'reference': 'KRM K07097330; K01035410 glosses the ⺊ form 俗處字',
        'url': 'https://viewer.hdic.jp/krm-public/show/K0709733',
        'witness': 'Kanchi-in manuscript of the Ruiju Myōgishō, Hōge 97.3.3 (Tenri 391.3.3), copied 1241/1251',
        'image': 'https://dl.ndl.go.jp/api/iiif/2586897/R0000052/full/1200,/0/default.jpg',
        'limitation': 'Regularized editorial outlines, not a facsimile or an encoded-character identification. The manuscript informs the joined centred stem and extended rightward horizontal dot; each face uses its own 上 and 冖 donors with editorial stem spacing. GlyphWiki is a comparison witness, not an outline donor.',
        'comparison': 'https://glyphwiki.org/glyph/hdic_hkrm-01035410.svg',
        'gloss': 'K07097330: 俗; K01035410: 俗處字',
        'kaisho': 'Kureedo 上 without its baseline, with editorial stem spacing and an extended rightward bar, over native 冖.',
        'donors': {'sans': ['上', '冖'], 'serif': ['上', '冖'], 'kaisho': ['上', '冖']},
        'forms': ['⿱⺊冖'],
    },
}
Path('src/composer/component-forms.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
