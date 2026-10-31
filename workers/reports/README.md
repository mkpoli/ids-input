# The report intake

`ids-reports` is the Cloudflare Worker behind the workshop's bug report form. A reporter needs no
account: the Worker takes what the browser collected, files it as an issue on
[mkpoli/ids-input](https://github.com/mkpoli/ids-input), and answers with the issue's number and URL.

## The endpoint

### `POST /`

`multipart/form-data`, answered as JSON. Every field is a string part except `image` and
`documentFile`, which have to be file parts; a string sent for either is ignored.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| `symptom` | yes | 1–4000 characters | What went wrong, in the reporter's own words |
| `sequence` | no | 2000 code units | The IDS text being edited |
| `link` | no | must start with `https://ids.mkpo.li/` | A share URL for the document |
| `document` | no | 200 KB | The document as JSON |
| `context` | no | 32 KB | A JSON object of environment facts |
| `contact` | no | 200 characters | A handle or an email, if the reporter wants an answer |
| `turnstile` | when a secret is set | — | The Turnstile token |
| `image` | no | 5 MB, PNG, JPEG or WebP | The drawing as it looked |
| `documentFile` | no | 200 KB, JSON | The document as a file |

A `fingerprint` field is accepted and ignored; the dedupe key is computed here.

The keys `context` is read for, in the order the issue's environment table lists them:
`appVersion`, `commit`, `route`, `preview` (the preview's step and badge), `viewport`,
`devicePixelRatio`, `locale`, `theme`, `face`, `userAgent`, `platform`, `fonts` (an array),
`composerBase`, `local`, `previewVersion` and `historyLength`. `face` and the rest of the settings ride in `context`. A `console` array holds the recent log lines. A
missing key reads as `—`. `locale`, when it is one of `en ja zh-Hans zh-Hant ko vi`, also decides
the `lang:<locale>` label.

Answers:

```json
201 {"number": 123, "url": "https://github.com/mkpoli/ids-input/issues/123", "duplicate": false}
200 {"number": 123, "url": "https://github.com/mkpoli/ids-input/issues/123", "duplicate": true}
```

A `200` means the same sequence and symptom came in within the last fortnight; the existing issue
gets a one-line comment instead of a second issue.

An error is `{"error": "<code>", "message": "<sentence>"}`:

| Status | Code |
| --- | --- |
| 400 | `invalid_request` |
| 403 | `forbidden_origin`, `captcha_failed` |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 413 | `too_large` |
| 415 | `unsupported_media_type` |
| 429 | `rate_limited` |
| 502 | `upstream_error` |

### `GET /health`

`{"ok": true}`.

### `OPTIONS`

The preflight. `Access-Control-Allow-Methods: POST, OPTIONS`, and `Vary: Origin` on every answer.
Only `https://ids.mkpo.li`, its preview versions on `*.workers.dev` and any port of
`http://localhost` are allowed; another origin gets `403`. A request with no `Origin` header is not a browser's and passes, so `curl` works.

## What the Worker does with a report

The issue body holds the symptom, the sequence in a fenced block, the share link, the drawing, a
table of the environment, and the console output, the document and the reporter folded into
`<details>`. Every submitted value is escaped for Markdown first, so nothing a reporter writes can
format the issue or arrive as HTML. A `@` is followed by a zero-width space, since a backslash does
not stop GitHub notifying the account a symptom happens to name.

An issue body may hold 65536 characters, which a 200 KB document would overrun on its own, so each
part the reporter controls is cut to a share of that budget: 20000 characters of the document, 8000
of console output, 500 per table cell. A cut part says it was cut, and the uploaded `documentFile`
still carries the whole thing.

Images and the uploaded document go to the orphan branch `bug-attachments` under
`reports/<yyyy>/<mm>/<uuid>.<ext>`, through the Git Data API, and the body points at
`https://github.com/mkpoli/ids-input/raw/bug-attachments/<path>`. The extension comes from the
file's magic bytes, never from what the client called it. When the upload fails the issue is still
filed, with a line saying the attachment could not be stored.

Abuse control: the total body is capped at 8 MB, checked against `Content-Length` before any of it
is read and counted off the stream as well, since a chunked body carries no length. Per
`CF-Connecting-IP` a reporter may file five an hour and twenty a day, against three hundred a day
for everyone.

The counters are KV keys in fixed windows, so they expire on their own. The day's total is split
over ten keys, because KV accepts one write a second to a key and a single counter would be written
on every report. Counting is best effort throughout: KV is eventually consistent, so a simultaneous
burst across edges can slip one or two past a limit, and a rejected counter write is logged rather
than charged to the reporter.

## Configuration

Vars live in `wrangler.jsonc`: `REPO` and `SITE_ORIGIN`, plus the `REPORTS` KV binding.

Secrets:

| Secret | Required | What it is |
| --- | --- | --- |
| `GITHUB_TOKEN` | yes | A fine-grained token on the repository with **Issues: write** and **Contents: write** |
| `TURNSTILE_SECRET` | no | A Turnstile secret key. Unset, the challenge is skipped entirely |

## Running and deploying

```sh
cd workers/reports
bunx wrangler secret put GITHUB_TOKEN     # paste the token
bunx wrangler dev                         # http://localhost:8787
bunx wrangler deploy
```

`wrangler dev` reads secrets from a `.dev.vars` file next to `wrangler.jsonc`:

```sh
printf 'GITHUB_TOKEN=%s\n' "$(gh auth token)" > .dev.vars
```

A report by hand:

```sh
curl -sS http://localhost:8787/ \
  -F symptom='The preview is blank after I switch the face.' \
  -F sequence='⿰亻哥' \
  -F link='https://ids.mkpo.li/#s=abc' \
  -F document='{"root":{"kind":"character","value":"亻"}}' \
  -F context='{"appVersion":"0.1.0","locale":"ja","console":["TypeError: x is not a function"]}' \
  -F image=@drawing.png
```

The tests are in `tests/report-worker.test.js` at the repository root and run with the rest:
`bun test tests`.

## Deploying

`.github/workflows/reports.yml` deploys from `main` whenever `workers/reports/` changes, so a merge
is enough. Two repository secrets have to exist first:

| Secret | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A token with **Workers Scripts: Edit**, **Workers KV Storage: Edit** and, for the custom domain, **Workers Routes: Edit** on the zone |
| `REPORTS_GITHUB_TOKEN` | The Worker's fine-grained `GITHUB_TOKEN`, re-applied on every deploy |

Until both are set the job skips itself and the deploy stays manual; the token is re-applied before
each deploy, so a version never goes out without it. The Worker answers on
`report.ids.mkpo.li` (a custom domain in the config) and on `ids-reports.mkpoli.workers.dev`.
