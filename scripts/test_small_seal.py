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

class PaletteTests(unittest.TestCase):
    def test_grouping_keeps_source_and_inference_separate(self):
        from build_small_seal_palette import compile_palette
        basic, source, inferred, unknown, absent = map(chr, range(0x3D000, 0x3D005))
        records = {basic: {'kSEAL_MCJK': '6728', 'kSEAL_Rad': '1.3D000'}}
        doc = {'records': [
            {'char': basic, 'descriptions': []},
            {'char': source, 'descriptions': [{'original': '&U-i001+2FF1;&UNKNOWN;木', 'text': '&U-i001+2FF1;&UNKNOWN;木'}]},
            {'char': inferred, 'descriptions': []},
            {'char': unknown, 'descriptions': []},
            {'char': absent, 'descriptions': []}],
            'modern': {source: ['林'], inferred: ['森'], unknown: ['？']}, 'table': {}}
        compile_palette(doc, records, {basic, source, inferred, unknown}, {'森': ['⿱木林']})
        parts = {p['part']: p for p in doc['parts']}
        self.assertEqual(parts[basic]['sealGroup'], 'basic')
        self.assertEqual(parts[source]['sealBasis'], 'seal-ids')
        self.assertEqual(parts[inferred]['sealBasis'], 'cjk-ids')
        self.assertEqual(parts[inferred]['modernIds'], ['⿱木林'])
        self.assertEqual(parts[unknown]['sealGroup'], 'other')
        self.assertNotIn(absent, parts)
        self.assertEqual(doc['table'], {})

class SealSupplementEvidence(unittest.TestCase):
    def test_every_crosswalk_matches_pinned_sources(self):
        import gzip, hashlib, json, tarfile
        from pathlib import Path
        from build_small_seal import sexps, properties
        root = Path(__file__).resolve().parents[1]
        entries = json.loads((root / 'scripts/data/small-seal/supplements.json').read_text(encoding='utf-8'))['entries']
        self.assertTrue(entries)
        archive = root / 'data/small-seal-sources.tar.gz'
        archiveSha = hashlib.sha256(archive.read_bytes()).hexdigest()
        sources = gzip.decompress((root / 'data/seal-sources.txt.gz').read_bytes()).decode().splitlines()
        unicodeSha = hashlib.sha256((root / 'data/seal-sources.txt.gz').read_bytes()).hexdigest()
        with tarfile.open(archive) as tar:
            texts = {m.name: tar.extractfile(m).read().decode() for m in tar.getmembers() if m.name.endswith('.el')}
        for entry in entries:
            self.assertTrue(0x3D000 <= ord(entry['char']) <= 0x3FC3F, entry['char'])
            unicodeEvidence, chiseEvidence = entry['unicodeEvidence'], entry['chiseEvidence']
            self.assertEqual(unicodeEvidence['sha256'], unicodeSha)
            self.assertIn(f"U+{ord(entry['char']):X}\tkSEAL_MCJK\t{unicodeEvidence['value']}", sources)
            self.assertIn(chr(int(unicodeEvidence['value'].split()[0], 16)), entry['modern'])
            self.assertEqual(chiseEvidence['archiveSha256'], archiveSha)
            number = int(chiseEvidence['record'].rsplit('-', 1)[-1])
            record = next(form[1][1] for form in sexps(texts[chiseEvidence['file']]) if isinstance(form, list)
                          and form[0] == 'define-char' and int(properties(form[1][1]).get('=shuowen-jiguge', 0)) == number)
            relation = next(p for p in record if isinstance(p, list) and p[0] == chiseEvidence['relation'])
            modern = {chr(int(properties(p)['=ucs'][2:], 16)) for p in relation[1:] if properties(p).get('=ucs', '').startswith('#x')}
            self.assertEqual(set(entry['modern']), modern)
            glyph = (root / 'scripts/data/small-seal' / entry['glyph']).read_bytes()
            self.assertEqual(hashlib.sha256(glyph).hexdigest(), entry['glyphSha256'])
            self.assertIn(b'<path ', glyph)


class ShippedCrosswalkTests(unittest.TestCase):
    def test_dataset_palette_carries_every_crosswalk(self):
        import gzip, json
        from pathlib import Path
        root = Path(__file__).resolve().parents[1]
        entries = json.loads((root / 'scripts/data/small-seal/supplements.json').read_text())['entries']
        doc = json.loads(gzip.decompress((root / 'data/small-seal.json.gz').read_bytes()))
        outlines = json.loads(gzip.decompress((root / 'data/small-seal-outlines.json.gz').read_bytes()))
        parts = {part['part']: part for part in doc['parts']}
        for entry in entries:
            char = entry['char']
            self.assertIn(char, doc['modern'])
            self.assertTrue(set(entry['modern']) <= set(doc['modern'][char]))
            self.assertEqual(parts[char]['sealBasis'], 'crosswalk')
            self.assertEqual(parts[char]['sealGroup'], 'other')
            self.assertEqual(parts[char]['modern'], entry['modern'])
            self.assertIn(char, outlines['records'])
        self.assertEqual(len([p for p in doc['parts'] if p.get('sealBasis') == 'crosswalk']), len(entries))


if __name__ == '__main__': unittest.main()
