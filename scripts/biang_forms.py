"""Reading-order leaf groups from the pinned Noto U+30EDE outlines.

Cuts follow the junctions where neighboring leaves share one contour. Every
cut has the same chord on both sides, preserving the complete native outline.
"""
IDS = '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心'


def sections(contour, *ranges):
    """Close selected command runs, joining their endpoints with straight cuts."""
    result = []
    for start, end in ranges:
        point = contour[start][1][-1]
        result.append(('lineTo' if result else 'moveTo', (point,)))
        result.extend(contour[start + 1:end + 1])
    return result + [('closePath', ())]


def outside(contour, start, end):
    return sections(contour, (end, len(contour) - 2), (0, start))


def biang_noto(cs, style):
    c = cs('𰻞')
    if style == 'sans':
        crown = sections(c[15], (4, 27))
        left_thread = outside(c[15], 4, 27)
        right_long = sections(c[18], (3, 32))
        heart_dot = outside(c[18], 3, 32)
        groups = [
            [c[6], c[28]], [crown], [c[25], c[26], c[27]],
            [left_thread], [c[16], c[17], c[24]], c[:6],
            [c[i] for i in [9, 10, 11, 20, 21, 22, 23]],
            [c[30]], [right_long, c[19], c[29]], [c[7], c[8]],
            [c[12], c[13], c[14], heart_dot],
        ]
    else:
        crown = sections(c[12], (0, 4), (19, 20), (28, 45))
        moon = sections(c[12], (4, 19))
        left_thread_top = sections(c[12], (20, 28))
        speech = outside(c[10], 9, 50)
        horse = sections(c[10], (9, 50))
        left_thread = outside(c[16], 9, 55)
        left_long = sections(c[16], (9, 21), (27, 55))
        horse_dot = sections(c[16], (21, 27))
        right_thread = outside(c[14], 18, 65)
        right_long = sections(c[14], (18, 36), (43, 65))
        knife = sections(c[14], (36, 43))
        groups = [
            [c[9], c[11]], [crown, c[7], c[26]], [moon, c[27], c[28]],
            [left_thread_top, left_thread], [left_long, c[15], c[19]],
            [speech, c[0], c[23], c[24], c[25]],
            [horse, horse_dot, c[1], c[2], c[20], c[21], c[22]],
            [right_thread, c[17]], [right_long, c[13], c[18]], [knife, c[8]],
            [c[3], c[4], c[5], c[6]],
        ]
    return groups
