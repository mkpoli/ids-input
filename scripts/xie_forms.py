"""Editorial JYN00003 outlines: native 寫 roof, hook and dots with an upright middle.

Reference: https://jyutnet.github.io/unencoded-characters/#JYN00003
陳瑞祺, 道漢字音 (1939), volume 2, p.72:
https://jyutnet.github.io/unencoded-characters/evidences/CSK1939/0072.png
The small printed witness establishes stroke structure, not exact font contours.
"""
MIDDLE = '⿰丨⿴⿻冂一一'
BOTTOM = '⿹𠃌灬'
BODY = '⿱' + MIDDLE + BOTTOM
FULL = '⿳宀' + MIDDLE + BOTTOM
BINARY = '⿱宀' + BODY


def move(x, y): return ('moveTo', ((x, y),))
def line(x, y): return ('lineTo', ((x, y),))
CLOSE = ('closePath', ())


def polygon(points):
    return [move(*points[0])] + [line(*p) for p in points[1:]] + [CLOSE]


def transform(contour, xmap, ymap=lambda y: y):
    return [(op, tuple((xmap(x), ymap(y)) for x, y in points)) for op, points in contour]


def xie_noto(cs, style):
    """Seven leaf groups in IDS order; shared strokes meet at unambiguous seams.

    寫's font-native curved terminal and four dots retain their common placement.
    The middle uses the donor's stem/bar weights and terminals. Its lower 一
    sits above the hook crossbar; the left upright connects these distinct strokes.
    """
    c = cs('寫')
    if style == 'sans':
        roof, frame = c[3], c[4]
        # Extract the first dot from the donor's connected sweeping stroke.
        dots = [[move(207, 133)] + frame[19:22] + [CLOSE]] + c[:3]
        hook = [move(280, 184)] + frame[24:33] + [line(280, 246), CLOSE]
        stem = polygon([(280,246),(347,246),(347,611),(280,611)])
        enclosure = polygon([(465,330),(532,330),(532,556),(738,556),
                             (738,330),(808,330),(808,611),(465,611)])
        middle = polygon([(532,415),(738,415),(738,470),(532,470)])
        upper, lower, right = 330, 275, 808
    else:
        frame = c[4]
        # The Serif roof and body share one contour; reconnect the roof at its
        # native right terminal, omitting the intervening 臼 and bottom strokes.
        roof = frame[:7] + [line(819,598)] + frame[61:]
        dots = [c[3]] + c[:3]
        hook = [move(280,212)] + frame[38:50] + [line(280,241), CLOSE]
        stem = polygon([(280,241),(343,241),(343,589),(280,612)])
        enclosure = ([move(465,325),line(529,325),line(529,583),line(722,583),
                      line(722,325),line(786,325)] + frame[58:60] +
                     [line(748,652),line(712,613),line(529,613),line(465,636),CLOSE])
        middle = polygon([(529,439),(722,439),(722,469),(529,469)])
        upper, lower, right = 325, 295, 786
    narrow = lambda x: 300 + (x - 280) * 400 / (right - 280)
    bottom_x = lambda x: 300 + (x - 280) * 550 / 617
    stem, enclosure, middle = [transform(p, narrow) for p in (stem, enclosure, middle)]
    hook = transform(hook, bottom_x)
    # Both horizontal strokes remain visible; the upright bridges their gap.
    baseline = polygon([(300,lower),(700,lower),(700,upper),(300,upper)])
    dots = [transform(p, bottom_x, lambda y: 20 + y * .8) for p in dots]
    return [[roof], [stem], [enclosure], [baseline], [middle], [hook], dots]


def register(forms, groups):
    forms[FULL] = groups
    forms[BINARY] = groups
    forms[BODY] = groups[1:]


PROVENANCE = {
    'kind': 'editorial font-derived outline',
    'reference': 'JYutnet JYN00003',
    'url': 'https://jyutnet.github.io/unencoded-characters/#JYN00003',
    'witness': '陳瑞祺, 道漢字音, 1939, volume 2, p.72',
    'image': 'https://jyutnet.github.io/unencoded-characters/evidences/CSK1939/0072.png',
    'limitation': 'The low-resolution printed witness establishes structure; stroke contours and spacing are editorial.',
    'donors': ['寫'],
    'forms': [FULL, BINARY, BODY],
}
