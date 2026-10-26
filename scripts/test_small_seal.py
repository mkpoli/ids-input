"""Importer invariants: python3 -m unittest discover -s scripts -p test_small_seal.py."""
import unittest
from build_small_seal import mappings, compile_data, sexps

class ImportTests(unittest.TestCase):
    def test_exact_properties_only(self):
        source = """(define-char '((=ucs . #x3D000) (=shuowen-jiguge . 00100)
          (<-Small-Seal@shuowen ((=ucs . #x4E00)))
          (->subsumptive ((=shuowen-jiguge5 . 00100)))) )
        (define-char '((=shuowen-jiguge . 00200)
          (<-Small-Seal@shuowen ((=ucs . #x3D001)))))"""
        found, modern = mappings([source])
        self.assertEqual(found, {'&SW-JIGUGE-00100;': chr(0x3D000)})
        self.assertEqual(modern[chr(0x3D000)], {'一'})

    def test_ambiguous_entity_is_not_resolved(self):
        sources = [f"(define-char '((=ucs . #x{c}) (=shuowen-jiguge . 00100)))" for c in ['3D000', '3D001']]
        self.assertEqual(mappings(sources)[0], {})

    def test_preserve_apparent_and_reject_bad_sequences(self):
        text = ('SW-JIGUGE-00100\t&SW-JIGUGE-00100;\t⿰木木\t@apparent=⿱木木\n'
                'SW-JIGUGE-00200\t&SW-JIGUGE-00200;\t⿰&UNKNOWN;木\n'
                'SW-JIGUGE-00300\t&SW-JIGUGE-00300;\t⿰木\n')
        mapping = {f'&SW-JIGUGE-{i:05d};': chr(0x3D000+i//100) for i in [100, 200, 300]}
        data = compile_data(text, mapping, {})
        self.assertEqual(data['table'], {chr(0x3D001): ['⿰木木', '⿱木木']})
        self.assertEqual(data['records'][0]['descriptions'][1]['kind'], 'apparent')
        self.assertEqual(data['records'][1]['descriptions'][0]['unresolved'], ['&UNKNOWN;'])
        self.assertEqual(data['records'][2]['descriptions'][0]['status'], 'unsupported')

    def test_reader_does_not_evaluate_and_handles_comments_strings(self):
        self.assertEqual(sexps(';comment\n(foo "a;b(\\\"c" \'x)'), [['foo', '"a;b(\\\"c"', ['quote', 'x']]])
        with self.assertRaises(ValueError): sexps('(foo')
        with self.assertRaises(ValueError): sexps(')')

if __name__ == '__main__': unittest.main()
