"""Editorial JYN00003 form, in Kureedo's original 1000-unit em.

Shape reference: https://jyutnet.github.io/unencoded-characters/#JYN00003
Witness: https://jyutnet.github.io/unencoded-characters/evidences/CSK1939/0072.png
Exact IDS: ⿳宀⿰丨⿴⿻冂一一⿹𠃌灬.
Donors: bundled Kureedo-Regular.woff2, 寫 U+5BEB, 旧 U+65E7, 目 U+76EE.
"""
import pathops
from fontTools.pens.recordingPen import RecordingPen, replayRecording


def _contours(gs, name):
    pen = RecordingPen()
    gs[name].draw(pen)
    return _split(pen.value)


def _split(commands):
    result, contour = [], []
    for op in commands:
        contour.append(op)
        if op[0] in ('closePath', 'endPath'):
            result.append(contour)
            contour = []
    return result


def _map(contour, transform):
    return [(op, tuple(transform(x, y) for x, y in points))
            for op, points in contour]


def _weighted(contour):
    """Restore native brush weight after fitting: 10 units per outline edge.

    Kureedo's 旧 and 目 stems measure about 47–56 units in the source em.
    Scaling to the roof's opening gives 25–29; a 20-unit boundary stroke
    restores 45–49 without changing the donor's slant or counter placement.
    """
    shape = pathops.Path()
    replayRecording(contour, shape.getPen())
    edge = pathops.Path(shape)
    edge.stroke(20, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    edge.convertConicsToQuads(.1)
    pen = RecordingPen()
    pathops.op(shape, edge, pathops.PathOp.UNION).draw(pen)
    return _split(pen.value)


def xie_kaisho(gs, cmap):
    """Return groups: 宀, 丨, 冂, lower 一, upper 一, 𠃌, 灬.

    Native 目 supplies the frame and both interior bars; its bottom bar is
    supplied by 寫's hook crossbar. Native 旧 supplies the separate upright.
    The middle uses one near-uniform transform and one common brush weight.
    """
    xie = _contours(gs, cmap[ord('寫')])
    eye = _contours(gs, cmap[ord('目')])
    old = _contours(gs, cmap[ord('旧')])
    assert len(xie) == 6 and len(eye) == 4 and len(old) == 4
    body, outer = xie[1], eye[0]
    assert body[1] == ('lineTo', ((790, 226),))
    assert outer[4] == ('lineTo', ((777, 657),))

    move = lambda x, y: ('moveTo', ((x, y),))
    line = lambda x, y: ('lineTo', ((x, y),))
    close = ('closePath', ())
    # The outer top and both inner edges follow 目's three native counters.
    frame = [move(756,74)] + outer[4:14] + [
        line(295,51), line(290,234), line(289,277), line(284,436),
        line(283,481), line(278,649), line(720,673), line(716,504),
        line(715,458), line(711,296), line(710,253), line(706,66), close]
    upper = [move(283,481), line(716,504), line(715,458), line(284,436), close]
    lower = [move(289,277), line(711,296), line(710,253), line(290,234), close]
    # Keep 旧's native tapered foot: the separate upright reaches the hook
    # crossbar, as in the donor, without a horizontal bridge into the frame.
    upright = old[0]

    fit = lambda x, y: (x * .52 + 310, y * .45 + 301)
    # Extend only the four foot vertices into the hook; the native side edges
    # above the lowest counter retain their original direction.
    frame = _map(frame, lambda x, y: (x * .52 + 310, 300 if y <= 74 else y * .45 + 301))
    upright = _map(upright, lambda x, y: (x * .52 + 196,
                 300 + (y + 55) * 333 / 770))

    # Retain the roof, curved terminal and dots at their contextual placement.
    hook = [move(270,205)] + body[1:12] + [line(270,245), close]
    hook = _map(hook, lambda x, y: (x, y + 65))
    dots = []
    for contour, cx, cy, target_y in zip(
            xie[2:], [655, 538.5, 409.5, 252], [125, 97.5, 72.5, 60],
            [180, 175, 170, 165], strict=True):
        dots.append(_map(contour, lambda x, y: (cx + (x - cx) * .65,
                                                target_y + (y - cy) * .65)))
    # Re-space the weighted bars vertically; translation preserves their native
    # rising angle while keeping the three clear openings optically equal.
    lower = _map(_map(lower, fit), lambda x, y: (x, y - 16))
    upper = _map(_map(upper, fit), lambda x, y: (x, y - 7))
    return [xie[:1], _weighted(upright), _weighted(frame),
            _weighted(lower), _weighted(upper), [hook], dots]
