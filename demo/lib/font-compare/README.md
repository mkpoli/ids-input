# Font comparison data

The page draws each record in the five composer exports. These files hold what it draws.

- `qianziwen.json` — 周興嗣's 千字文, the 1,000 characters of the poem in order, from
  [Wikisource](https://zh.wikisource.org/wiki/千字文) (public domain). Variant readings use the
  first form; 云 and 御 are unwrapped from the source's `-{…}-` markup.
- `poems.json` — 靜夜思 and 早發白帝城 by 李白, 江雪 by 柳宗元, and 相思 by 王維, from their
  Wikisource pages. `characters` holds the distinct characters in reading order; `lines` keeps the
  punctuated text.
- `unencoded.json` — 4,894 visible records of the sibling unencoded-db site, exported 2026-11-28
  from its D1 database (`45d05e76-22c8-40f8-a81f-6ddbf4899724`). It selects `id`, `ids`,
  `description`, `status`, `radical` and `strokes`, skipping hidden and merged records.

Refresh the unencoded records with:

```sh
npx wrangler d1 execute 45d05e76-22c8-40f8-a81f-6ddbf4899724 --remote --json --command \
  "SELECT id, ids, description, status, radical, strokes FROM entries WHERE hidden_at IS NULL AND merged_into IS NULL AND ((ids IS NOT NULL AND ids != '') OR (description IS NOT NULL AND description != '')) ORDER BY id" \
  | jq '.[0].results' > demo/lib/font-compare/unencoded.json
```

The examples come from `demo/lib/examples.js`, not from a file here.
