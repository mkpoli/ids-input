# Character recognizers

The Find tab's whole-character results combine two single-character classifiers in every locale:
DaKanji supplies Japanese kanji and kana, and GlyphWeave supplies simplified and traditional
Chinese. Both models and ONNX Runtime load on the first drawing.

## DaKanji

- Project: <https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition> by CaptainDario
  (Dariyooo).
- Release: `v2.0`, asset `char_classifier_onnx.zip`, file `char_classifier.onnx`; labels
  `char_classifier_labels.txt` from `char_classifier_labels.zip`.
- Licence: MIT (`LICENSE` in this folder). The author released the weights under MIT.
- Training data: the [ETL Character Database](http://etlcdb.db.aist.go.jp/) (AIST) and
  [KanjiVG](https://kanjivg.tagaini.net/) (CC BY-SA 3.0). The ETL database has its own terms;
  check them before a commercial deployment.
- Credit: “Character recognition powered by machine learning from Dariyooo (DaAppLab)”.
- Coverage: 6,507 classes: Japanese kanji, hiragana and katakana. Simplified forms such as 门, 马
  and 这 are absent; GlyphWeave supplies those alongside it.
- Input: one grayscale image, white ink on black, 128×128 in the demo. The model resizes and
  normalises internally.
- SHA-256: model `2c8d334e1541720dd1f8603a9dc3ecd270842756c99fbe24ce2de3e925e1f4a7`;
  labels `a3b26bee5c6b37f3e76f802c8012c6b00c0dfbcda90de1a208d62386b2c6b3ba`.

## GlyphWeave

- Project: <https://github.com/13536309143/GlyphWeave> by 13536309143.
- Release: `v1.0.0`, asset `glyphweave-v1.0.0-inference.zip`, checkpoint `best.pt`; classes from
  `classes.txt`. The released checkpoint is PyTorch; this copy was exported to ONNX at 128×128 and
  quantized to int8 with ONNX Runtime's static QDQ quantizer, calibrated on 120 Noto Sans CJK JP
  glyphs. The export and quantizer are not part of this repository.
- Licence: MIT (`LICENSE-glyphweave` in this folder).
- Training data: CASIA-HWDB (NLPR, CASIA) and EMNIST (NIST). CASIA-HWDB has research-use terms;
  check them before a commercial deployment.
- Coverage: 7,247 classes: 7,185 Han characters plus digits and Latin letters. The pad keeps the
  Han results and drops the other 62 classes. No kana.
- Input: one grayscale image, black ink on white, 128×128. The demo crops the ink, scales it to 76%
  of the square, pads it, and normalises to `[-1, 1]`.
- SHA-256: model `247e74183076e944ceb24f8b863ec2148a989fcc7001bd1be20790c662264dd5`;
  labels `1008b208dac9a818274ef0f1f674bbf924fe1b7bedae36fcf45d952b42117f2d`.

## Benchmarks

On the 20 synthetic stroke drawings in `benchmark.json`, DaKanji puts 19 targets in the top 24 and
18 in the top 10. GlyphWeave, used by the English benchmark, puts 19 in the top 24. The drawings
are geometric stroke sequences, not samples from human writers; the released GlyphWeave manifest
reports 96.0% top-1 and 97.6% macro-average on its 870,895-sample test split.
