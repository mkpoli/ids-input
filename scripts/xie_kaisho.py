"""Editorial JYN00003 form, in Kureedo's original 1000-unit em.

Shape reference: https://jyutnet.github.io/unencoded-characters/#JYN00003
Witness: https://jyutnet.github.io/unencoded-characters/evidences/CSK1939/0072.png
Exact IDS:
⿳宀⿰丨⿴⿻冂一一⿹𠃌灬. Donors: bundled Kureedo-Regular.woff2,
寫 U+5BEB, 日 U+65E5, 丨 U+4E28. The caller owns source metadata.
"""
from fontTools.pens.recordingPen import RecordingPen


def _contours(gs, name):
    pen = RecordingPen()
    gs[name].draw(pen)
    result, contour = [], []
    for op in pen.value:
        contour.append(op)
        if op[0] in ('closePath', 'endPath'):
            result.append(contour)
            contour = []
    return result


def _map(contour, transform):
    return [(op, tuple(transform(x, y) for x, y in points))
            for op, points in contour]


def _piecewise(value, knots):
    i = next((i for i in range(len(knots) - 1)
              if value <= knots[i + 1][0]), len(knots) - 2)
    a, b = knots[i], knots[i + 1]
    return a[1] + (value - a[0]) * (b[1] - a[1]) / (b[0] - a[0])


def xie_kaisho(gs, cmap):
    """Return groups: 宀, 丨, 冂, baseline 一, middle 一, 𠃌, 灬.

    日's counter boundaries define the shared seams of 冂 and the two 一.
    The lower 一 owns the shared baseline extending to 丨; 寫's separate
    hook crossbar adjoins its underside. No normalization is applied.
    """
    xie = _contours(gs, cmap[ord('寫')])
    day = _contours(gs, cmap[ord('日')])
    stem = _contours(gs, cmap[ord('丨')])[0]
    assert len(xie) == 6 and len(day) == 3
    body, outer = xie[1], day[0]
    # These splice points belong to the bundled font's original outlines.
    assert body[1] == ('lineTo', ((790, 226),))
    assert outer[4] == ('lineTo', ((759, 650),))

    def frame_map(x, y):
        # Contract counters more than brush strokes and preserve sloping bars.
        return (_piecewise(x, [(227, 450), (314, 495), (679, 630), (765, 675)]),
                _piecewise(y, [(5, 320), (50, 350), (327, 450),
                               (391, 485), (633, 590), (699, 625)]))

    # Inverted U: native outer top and terminals, native inner counter edge.
    # Intersect the straight outer-left edge with the lower counter's y=50.
    left_x = 245 + (625 - 50) * 17 / (625 - 26)
    frame = [('moveTo', ((729, 64),))] + outer[4:13] + [
        ('lineTo', ((left_x, 50),)), ('lineTo', ((311, 50),)),
        ('lineTo', ((302, 327),)), ('lineTo', ((300, 372),)),
        ('lineTo', ((293, 633),)), ('lineTo', ((705, 655),)),
        ('lineTo', ((693, 391),)), ('lineTo', ((691, 346),)),
        ('lineTo', ((679, 62),)), ('closePath', ())]
    middle = [('moveTo', ((300, 372),)), ('lineTo', ((693, 391),)),
              ('lineTo', ((691, 346),)), ('lineTo', ((302, 327),)),
              ('closePath', ())]
    # Close the native lower bar under both uprights, extending only its left
    # edge to the separate 丨. Its native right brush terminal is retained.
    baseline = _map(outer[:4] + [('lineTo', ((679, 62),)),
                    ('lineTo', ((311, 50),)), ('closePath', ())], frame_map)
    baseline = [baseline[0]] + baseline[1:-1] + [
        ('lineTo', (frame_map(left_x, 50),)),
        ('lineTo', ((300, 339),)), ('lineTo', ((300, 309),)),
        ('closePath', ())]

    # Keep 丨's natural cap and slight taper; cut its foot at the shared bar.
    upright = [('moveTo', ((465, 0),)), ('lineTo', ((525, 0),))] + stem[4:9] + [
        ('lineTo', ((471, 0),)), ('closePath', ())]
    upright = _map(upright, lambda x, y: (300 + (x - 465) * .8,
                                         315 + y * (295 / 783)))

    # 寫's native hook follows the first edge of its fused body. Drop the
    # left-falling sweep and all 臼 material, retaining every hook curve.
    hook = [('moveTo', ((300, 205),))] + body[1:12] + [
        ('lineTo', ((300, 245),)), ('closePath', ())]
    hook = _map(hook, lambda x, y: (x, y + 65))
    # Follow the baseline's underside with a one-unit interior overlap.
    # Independent path quantization otherwise exposes a subpixel slit at
    # the shared corner near x=494. This changes no exterior silhouette.
    seam = [frame_map(730, 18), frame_map(312, 5), (300, 309)]
    hook = hook[:-2] + [('lineTo', ((x, y + 1),)) for x, y in seam] + [
        ('closePath', ())]
    # Retain all four native brush gestures as small, independent dots.
    dots = []
    for contour, cx, cy, target_y in zip(
            xie[2:], [655, 538.5, 409.5, 252], [125, 97.5, 72.5, 60],
            [180, 175, 170, 165], strict=True):
        dots.append(_map(contour, lambda x, y: (cx + (x - cx) * .65,
                                                target_y + (y - cy) * .65)))
    return [xie[:1], [upright], [_map(frame, frame_map)],
            [baseline], [_map(middle, frame_map)], [hook], dots]
