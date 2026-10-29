# Character recognizer

The Find tab's whole-character results use DaKanji's single-character classifier.

- Project: <https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition> by CaptainDario
  (Dariyooo).
- Release: `v2.0`, asset `char_classifier_onnx.zip`, file `char_classifier.onnx`; labels
  `char_classifier_labels.txt` from `char_classifier_labels.zip`.
- Licence: MIT (`LICENSE` in this folder). The author released the weights under MIT.
- Training data: the [ETL Character Database](http://etlcdb.db.aist.go.jp/) (AIST) and
  [KanjiVG](https://kanjivg.tagaini.net/) (CC BY-SA 3.0). The ETL database has its own terms;
  check them before a commercial deployment.
- Credit: “Character recognition powered by machine learning from Dariyooo (DaAppLab)”.
- Coverage: 6,507 classes: Japanese kanji, hiragana and katakana. Chinese-only forms are not in
  its labels; the palette parts remain the fallback for components.
- Input: one grayscale image, white ink on black, 128×128 in the demo. The model resizes and
  normalises internally.
- SHA-256: model `2c8d334e1541720dd1f8603a9dc3ecd270842756c99fbe24ce2de3e925e1f4a7`;
  labels `a3b26bee5c6b37f3e76f802c8012c6b00c0dfbcda90de1a208d62386b2c6b3ba`.

On the 20 synthetic stroke drawings in `benchmark.json`, the target was in the top 24 for 19 and in the top 10 for
18.
