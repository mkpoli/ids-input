"""Reading invariants of the donor-part builder.

Run with python3 -m unittest discover -s scripts -p test_donor_parts.py.

Only the parts that need no font: the description is read, the layers come out
of it, and the pieces are dealt out in every way the geometry allows.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_donor_parts as donor  # noqa: E402


class ReadsDescriptions(unittest.TestCase):
    def test_numbered_component_is_one_token(self):
        root = donor.parse("⿱{42}山")
        self.assertEqual(root.operator, "⿱")
        self.assertEqual([child.text for child in root.children], ["{42}", "山"])

    def test_nested_description_keeps_its_own_text(self):
        root = donor.parse("⿳宀⿻又丷山")
        self.assertEqual([child.text for child in root.children], ["宀", "⿻又丷", "山"])
        self.assertEqual([leaf.text for leaf in donor.terminals(root)], ["宀", "又", "丷", "山"])

    def test_two_numbered_components_in_a_row(self):
        # Read character by character, ⿱{50}{50} would take `{` and `5` as its operands.
        root = donor.parse("⿰丨⿱{50}{50}")
        self.assertEqual([leaf.text for leaf in donor.terminals(root)], ["丨", "{50}", "{50}"])

    def test_an_incomplete_description_is_refused(self):
        with self.assertRaises(ValueError):
            donor.parse("⿱山")
        with self.assertRaises(ValueError):
            donor.parse("⿱山山山")


class NamesComponents(unittest.TestCase):
    def setUp(self):
        self.labels = donor.read_labels()

    def test_a_written_out_component_carries_its_fragment(self):
        self.assertEqual(self.labels["{42}"], "{42} 彐")
        self.assertEqual(donor.glyph_of("{42}", self.labels), "彐")

    def test_a_component_with_no_fragment_stays_bare(self):
        self.assertEqual(self.labels["{47}"], "{47}")
        self.assertEqual(donor.glyph_of("{47}", self.labels), "")

    def test_a_fragment_that_is_itself_a_description_names_no_glyph(self):
        self.assertEqual(self.labels["{86}"], "{86} ⿲丶丶丶")
        self.assertEqual(donor.glyph_of("{86}", self.labels), "")


class SpellsOutLeaves(unittest.TestCase):
    def setUp(self):
        self.table, self.labels = donor.read_table(), donor.read_labels()

    def test_a_compound_leaf_is_spelled_out_to_the_bottom(self):
        tree = donor.expand("山", self.table, self.labels)
        self.assertEqual([node["leaf"] for node in tree], ["凵", "丨"])
        self.assertEqual([node["children"] for node in tree], [[], []])

    def test_a_character_the_table_writes_as_itself_stops(self):
        self.assertEqual(donor.expand("又", self.table, self.labels), [])
        self.assertEqual(donor.expand("凵", self.table, self.labels), [])

    def test_a_numbered_component_is_not_looked_up(self):
        self.assertEqual(donor.expand("{42}", self.table, self.labels), [])

    def test_a_nested_operand_stops_where_it_is_not_one_character(self):
        tree = donor.expand("心", self.table, self.labels)
        self.assertEqual([node["leaf"] for node in tree], ["㇒", "⿻乚⿰丶丶"])
        self.assertEqual(tree[1]["children"], [])

    def test_a_description_that_contains_itself_terminates(self):
        table = {"回": ["⿴囗回"], "囗": ["囗"]}
        self.assertEqual(donor.expand("回", table, {}),
                         [{"leaf": "囗", "children": []}, {"leaf": "回", "children": []}])


class DealsPiecesOut(unittest.TestCase):
    def test_runs_keep_the_order_they_are_given(self):
        self.assertEqual(donor.runs([0, 1, 2], 1), [[[0, 1, 2]]])
        self.assertEqual(donor.runs([0, 1, 2], 2), [[[0], [1, 2]], [[0, 1], [2]]])
        self.assertEqual(donor.runs([0, 1, 2], 3), [[[0], [1], [2]]])
        self.assertEqual(donor.runs([0, 1], 3), [])

    def test_spreads_cover_every_way_of_dealing_the_pieces(self):
        spread = donor.spreads([0, 1, 2], 2)
        self.assertEqual(len(spread), 6)
        for groups in spread:
            self.assertTrue(all(groups))
            self.assertEqual(sorted(index for group in groups for index in group), [0, 1, 2])
        self.assertEqual(donor.spreads([0], 2), [])

    def test_a_repeated_element_is_named_by_its_position(self):
        root = donor.parse("⿱山山")
        top, bottom = donor.terminals(root)
        self.assertEqual(donor.position_of(root, top), "上")
        self.assertEqual(donor.position_of(root, bottom), "下")
        deep = donor.parse("⿳宀⿻又丷山")
        self.assertEqual(donor.position_of(deep, donor.terminals(deep)[1]), "中1")


class OrdersPieces(unittest.TestCase):
    def test_two_pieces_sharing_a_corner_still_sort_apart(self):
        # A key that stopped at the top-left corner would tie these two and leave
        # their order to whatever the boolean ops walked first.
        tall = square(0, 0, 40, 400)
        wide = square(0, 0, 400, 40)
        self.assertNotEqual(donor.piece_order(tall), donor.piece_order(wide))
        self.assertEqual(sorted([wide, tall], key=donor.piece_order),
                         sorted([tall, wide], key=donor.piece_order))

    def test_the_union_is_the_ink_of_both(self):
        both = donor.union_of([square(0, 0, 100, 100), square(50, 0, 150, 100)])
        self.assertAlmostEqual(abs(both.area), 15000, delta=1)
        apart = donor.union_of([square(0, 0, 100, 100), square(200, 0, 300, 100)])
        self.assertAlmostEqual(abs(apart.area), 20000, delta=1)


class PicksTheFamily(unittest.TestCase):
    def test_only_vertical_stacks_standing_on_山(self):
        chosen = dict(donor.selection({
            "岀": ["⿱山山"],
            "宻": ["⿳宀⿻又丷山"],
            "峃": ["⿱𰃮山"],
            "岈": ["⿰山牙"],
            "𠣢": ["⿱勹⿰刂山"],
            "崇": ["⿱山宗"],
            "七": ["〾⿻一乚"],
        }))
        self.assertEqual(sorted(chosen), ["宻", "岀", "峃"])

    def test_the_first_sequence_is_the_one_read(self):
        self.assertEqual(donor.selection({"㞼": ["⿱𠂉山", "⿱一山"]}), [("㞼", "⿱𠂉山")])


class WritesCommands(unittest.TestCase):
    def test_whole_numbers_stay_whole(self):
        self.assertEqual(donor.point((164.0, -80.0)), [164, -80])

    def test_everything_else_is_kept_to_a_thousandth(self):
        self.assertEqual(donor.point((164.0004, 12.3456)), [164, 12.346])

    def test_a_fingerprint_is_a_coverage_reading(self):
        side = donor.GRID
        self.assertEqual(len(donor.fingerprint([square(0, 0, 100, 100)])), side * side)
        full = donor.fingerprint([square(0, 0, 100, 100)])
        self.assertAlmostEqual(min(full), 1.0)
        # The same shape at another size reads the same, which is what makes a
        # squashed element recognisable.
        self.assertAlmostEqual(donor.likeness(full, donor.fingerprint([square(0, 0, 40, 400)])), 1.0)

    def test_likeness_falls_away_as_the_ink_moves(self):
        left = donor.fingerprint([square(0, 0, 100, 100)])
        corner = donor.fingerprint([square(0, 0, 100, 100), square(200, 200, 260, 260)])
        self.assertLess(donor.likeness(left, corner), 0.6)
        self.assertEqual(donor.likeness(left, left), 1.0)


def square(x0, y0, x1, y1):
    import pathops

    path = pathops.Path()
    pen = path.getPen()
    pen.moveTo((x0, y0))
    pen.lineTo((x1, y0))
    pen.lineTo((x1, y1))
    pen.lineTo((x0, y1))
    pen.closePath()
    return path


if __name__ == "__main__":
    unittest.main()
