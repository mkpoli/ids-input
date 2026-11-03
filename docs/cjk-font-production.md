# How a Han face is made

Status: reading notes, 2026-11-03, from published accounts and the project's public IDS room. The
counts and times are the cited sources'; where an account rounds a figure, the source behind it is
named.

## The set is the unit

A Latin face is a few hundred glyphs and can grow a character at a time. A Han face is sold as a
set: the foundry commits to a list before drawing, and the list sets the price. Running text needs
far fewer characters than the list holds. A 教育部 survey put the coverage of the 3,500 common
characters at 99.48% (文汇报 via 新华网, 2015-09-27); a mainland face has been built from GB2312's
6,763, and the working norm in Taiwan has been about 14,000 (Rti, 2026-07-14). The difference is
names, place names, dialect words and technical vocabulary.

## The sets

| Set | Characters | Source |
|---|---|---|
| 现代汉语常用字表 | 3,500 | [文汇报 via 新华网, 2015](http://www.xinhuanet.com/politics/2015-09/27/c_128271708.htm): 99.48% of running text |
| GB2312 | 6,763 | [北京商报, 2016](https://finance.sina.com.cn/stock/t/2016-10-14/doc-ifxwvpqh7372530.shtml); [HFH-Font, 2024](https://arxiv.org/abs/2410.06488) |
| 通用规范汉字表 | 8,105 | [国务院, 2013](https://www.gov.cn/gongbao/content/2013/content_2481095.htm); tier counts in [Wikipedia](https://en.wikipedia.org/wiki/List_of_Commonly_Used_Standard_Chinese_Characters): 3,500 + 3,000 + 1,605 |
| Big5 | 13,461 | [Rti, 2026](https://www.rti.org.tw/news?uid=3&pid=220237) |
| Taiwan working norm | ~14,000 | [Rti, 2026](https://www.rti.org.tw/news?uid=3&pid=220237) |
| 新細明體 | 28,974 | [Rti, 2026](https://www.rti.org.tw/news?uid=3&pid=220237) |
| 中华字海 | 85,568 | [文汇报 via 新华网, 2015](http://www.xinhuanet.com/politics/2015-09/27/c_128271708.htm) |
| GB18030-2022 | 87,887 | [市场监管总局, 2022](https://www.samr.gov.cn/xw/zj/art/2023/art_76ce782e7c584ea991c3a887d3ad0d02.html), 17,000 more than the 2005 edition |
| CNS 11643 | 107,000+ | [Rti, 2026](https://www.rti.org.tw/news?uid=3&pid=220237) |

Big5 and CNS counts move with the extensions included; Rti's figures are the ones cited here. Two
figures in Liu Yuli's account, 27,000 and 87,000, sit near 新細明體's 28,974 and GB18030-2022's
87,887. The account's 7,000 is a mainland rule of thumb; in Taiwan the working norm runs twice that.

## The line

### Seed

The first characters set the style. A designer quoted by Rti puts the styling stage at 0–300
characters and the cost gap at the expansion to 9,000 or 14,000 (Rti, 2026). The seed can be
written by hand: 郭敬明 wrote 786 characters for 汉仪郭敬明体, and the rest of the set was expanded
by technical means (北京商报, 2016). A model's seed can be chosen for coverage instead: HFH-Font's
reference set is 775 characters, picked so that every component in GB2312 appears (HFH-Font, 2024).

The three sizes answer different questions: style, handwriting, components.

### Expand

A team of a few designers takes six months to three years for a set of 6,763 to 20,000 characters,
according to a font developer quoted by 北京商报 (2016). HFH-Font conditions a diffusion model on
component and stroke references, generates 1024×1024 glyph images in one step, vectorizes them, and
reports a user study with professional designers (ACM TOG, 2024). The paper claims quality comparable
to manual work; that is a research result, not a shipped face.

The Sixth Tone piece reports that Chinese foundries have used internal AI tools for years, and that
open-source tools since the early 2020s let independent designers produce faces on their own. It
gives no production numbers.

### Ship less

The set is also a menu. 森澤文鼎's Arphic Big-5 Miniset defines 7,374 characters for display faces
(2024), first used by 文鼎濃湯體. justfont's jf 7000 put about 6,770 in a base pack, with packs for
Taiwanese, Hakka, indigenous romanization, names, Japanese and Hong Kong usage (2022). Both are
described in Rti's account from 2026-07-14.

### Sell

Licences are sold per year or in perpetuity. A celebrity hand was bought at ¥1,000 a character, and
piracy pushed a face listed at ¥1,000 down to ¥50 (北京商报, 2016). The set's size is the cost; the
price has to carry every character that may never be printed.

## What the room says

The project's IDS room — public, on Matrix, bridged to Discord, Telegram, QQ and IRC — holds the
account the published sources lack. Its history from 2026-10-24 to 2026-11-03 is about two dozen
people, mostly writing in Japanese and Chinese, and three exchanges carry the argument.

Sim-CH (@CheonHyeongSim), whose MetaHan proposal extends GlyphWiki and KAGE, replied to a
demonstration of the workshop on 2026-10-28. The reply, relayed into the room, says the logic is
部件-based rather than 筆画-based, like 葛炳崙's work from 2020, and that Möbius transforms do not
apply: “會把粗細炸得一塌糊塗” — the weights blow up. The maintainer conceded the 粗細不符 in the
room. The composer's answer is a weight pass: it draws from one face, falls back to another only
for components that face lacks, cuts parts from characters, and brings every stroke to the width a
real character of the result's density has. The design notes report the drawn stroke width at
0.998 and 1.003 of the real glyph's, median, across x and y on 1,981 compound jōyō kanji
(han-compose).

海楫 (@sebansios), building a generator for Jurchen and Khitan, described the alternative the same
day: take KAGE skeletons as input and let a model learn stroke width and 筆端 shapes from existing
fonts. By 2026-11-02 he had dropped the raster-and-diffusion route for direct control-point
prediction. His data problem is the tail: GlyphWiki's Jurchen glyphs differ from the Unicode
representative forms, so the skeleton data has to be made first.

The GenZui designer said on 2026-10-29 why the workshop matters to them: 古籍整理 needs characters
no font has, and “我不會做字體而且沒有工夫” — they cannot draw a typeface and have no time. For
them the workshop's starting point was 補字.

Also in the room: 字统网 is GlyphWiki data with the KAGE engine, hand-assembled; the
auto-composition is, by one account, 白老师's own, with custom syntax such as `(J,)` variants.
Variable fonts came up as an intermediate for design, with topology consistency across styles as
the hard part.

## What is still missing

The room gives the work a voice; it still gives no numbers. No source here, published or spoken,
gives time per glyph, proofreading, hinting or quality control; none says how much of a shipped set
is drawn rather than interpolated; none measures an AI tool's error rate on a production face. The
designer study in HFH-Font is the closest, and it evaluates generated glyphs, not a font release.

The gap is real: the field writes about sets and tools, while the work happens in studios that do
not publish. The room is where some of it is spoken.

## What it means here

- A set is a list. A character outside the list has no glyph, and often no code point. An IDS
  describes it anyway, which is the case this project exists for.
- The priors in HFH-Font are components and strokes. An IDS supplies the component structure
  explicitly, and this project already composes from parts.
- IDS describes structure, not weight. The composer takes weight from a face: one source font,
  parts cut from its characters, every stroke brought to the target density. That works where a
  face covers the script; the room's skeleton-to-outline models and variable-font intermediates
  are for the scripts where none does.
- The article's new characters — the chemical elements named by combining a semantic and a phonetic
  component — have no place in an existing set. A description plus composition shows them before a
  foundry commits to drawing them.
- The tail is where a set fails, and where a description beats a font.

## Sources

- 国务院. 关于公布《通用规范汉字表》的通知, 国发〔2013〕23号. 2013-06-05.
  <https://www.gov.cn/gongbao/content/2013/content_2481095.htm> — official notice; its tables are
  page images.
- Wikipedia. "List of Commonly Used Standard Chinese Characters." Read 2026-11-03.
  <https://en.wikipedia.org/wiki/List_of_Commonly_Used_Standard_Chinese_Characters> — secondary;
  the 8,105 total and the tier split come from here.
- 市场监管总局. 新版《信息技术 中文编码字符集》强制性国家标准发布. 2022-07-28.
  <https://www.samr.gov.cn/xw/zj/art/2023/art_76ce782e7c584ea991c3a887d3ad0d02.html>.
- 李婷. 专家批“冰封汉字”：掌握3500个常用字才是关键. 文汇报, via 新华网, 2015-09-27.
  <http://www.xinhuanet.com/politics/2015-09/27/c_128271708.htm> — journalism; the 99.48% figure is
  attributed there to a 教育部 survey.
- Rti 中央廣播電臺. 台灣字體復興／一套中文字型要造上萬字！如何砍半還不太會缺字？ 2026-07-14.
  <https://www.rti.org.tw/news?uid=3&pid=220237> — interviews with 王皓梅 of justfont and 李信儀
  of 森澤文鼎.
- 卢扬. 汉仪字库风光背后负重前行 回本期长盈利难. 北京商报, via 新浪财经, 2016-10-14.
  <https://finance.sina.com.cn/stock/t/2016-10-14/doc-ifxwvpqh7372530.shtml> — journalism; the
  786-character and ¥1,000 figures are the companies' own accounts.
- Li, Hua, and Zhouhui Lian. "HFH-Font: Few-shot Chinese Font Synthesis with Higher Quality, Faster
  Speed, and Higher Resolution." ACM TOG 43(6), 2024. <https://arxiv.org/abs/2410.06488>,
  DOI 10.1145/3687994.
- Liu, Yuli. "Writing on the Wall? How AI Is Reinventing Chinese Typography." Sixth Tone,
  2026-11-02. <https://www.sixthtone.com/news/1019200> — industry claims; its figures are the sets
  above, and the prices and tools it reports are attributed to the foundries and designers it quotes.
- IDS Workshop room, public Matrix history, 2026-10-24 to 2026-11-03. Messages are quoted as written,
  dated in the text and attributed by handle; a translation follows where the point depends on it.
  The Sim-CH reply was relayed into the room rather than posted there, and the 字统网 and GlyphWiki
  points are another speaker's account, not checked against either site's source.
- han-compose. "IDS composer: goals and open cases." Read 2026-11-04.
  <https://github.com/mkpoli/han-compose/blob/main/docs/design/ids-composer.md> — the stroke-width
  figures are its own bench on 1,981 compound jōyō kanji, not a review.
