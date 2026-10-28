# New Korean Orthography letters

The four letters the New Korean Orthography (조선어 신철자법, 1948) added to the Hangul
alphabet, as vector outlines for `IDS New Korean` and `data/new-korean-outlines.json.gz`.
Two further letters, ㅿ and ㆆ, are already encoded as Hangul jamo and are not drawn here.

| code points | Korean name | Unicode proposal | source |
| --- | --- | --- | --- |
| U+A97D, U+D7FC | 여린리을 (soft rieul) | `HANGUL CHOSEONG RIEU` / `HANGUL JONGSEONG RIEU` | `rieu.svg` |
| U+A97E, U+D7FD | 된리을 (strong rieul) | `HANGUL CHOSEONG LIEUL` / `HANGUL JONGSEONG LIEUL` | `lieul.svg` |
| U+A97F, U+D7FE | 위읍 (wi-eup) | `HANGUL CHOSEONG UEUB` / `HANGUL JONGSEONG UEUB` | `ueub.svg` |
| U+D7C7 | 여린이 (soft i) | `HANGUL JUNGSEONG BANMOEUM-I` | `banmoeumi.svg` |

The code points are **not assigned** in Unicode 18.0.0. They are the positions OBAYASHI
Muneaki proposed in [L2/19-230R, *Amended Proposal to add the "6 letters" (Hangul Jamo)*,
2019-06-24](https://www.unicode.org/L2/L2019/19230r-six-hangul-letters.pdf), which was
answered by [L2/19-233](https://www.unicode.org/L2/L2019/19233-hangul-cmts.pdf). The editor
accepts them as a bundled allocation, as it does for the Small Seal code points; they will
remain unassigned until Unicode acts on such a proposal. The initial and final entries share
one outline because the Commons source draws one form for each letter; a final entry is placed
by its position, not by a separately drawn final form.

The SVGs are [Nanuun-saram](https://commons.wikimedia.org/wiki/User:Nanuun-saram)'s drawings
on Wikimedia Commons, made 2016-02-08:

- [File:Nkchar-l.svg](https://commons.wikimedia.org/wiki/File:Nkchar-l.svg)
- [File:Nkchar-rr.svg](https://commons.wikimedia.org/wiki/File:Nkchar-rr.svg)
- [File:Nkchar-w.svg](https://commons.wikimedia.org/wiki/File:Nkchar-w.svg)
- [File:Nkchar-y.svg](https://commons.wikimedia.org/wiki/File:Nkchar-y.svg)

Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The font and
the outlines are derivatives of these files and keep the same licence; see
`fonts/LICENSE-IDSNewKorean.txt`.

The letters and names are described in
[朝鮮語新綴字法](https://ja.wikipedia.org/wiki/%E6%9C%9D%E9%AE%AE%E8%AA%9E%E6%96%B0%E7%B6%B4%E5%AD%97%E6%B3%95)
and [New Korean Orthography](https://en.wikipedia.org/wiki/New_Korean_Orthography).

Build the font and outlines with:

```sh
uv run scripts/build_new_korean.py
```
