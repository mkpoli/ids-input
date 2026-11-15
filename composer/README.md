# Composer exports

The glyph data the workshop draws from: han-compose's `export-web` output, one folder per version, in
this project's own R2 bucket and served by the Worker in `src/index.js`.

Publishing is a copy into the bucket. The Worker serves whatever it holds, so a new export needs no
deploy, no pull request and no change in another repository.

## Publishing

Build the export with han-compose, then publish it:

```sh
uv run --project ~/projects/Philology/han-compose python scripts/compose_ids.py \
  export-web ~/projects/Philology/exports/serif-8156f838798c --style serif --workers 3
scripts/publish_composer_export.sh ~/projects/Philology/exports/serif-8156f838798c
```

The script takes the version from the export's own `.export`, refuses a folder that is not finished
(`.complete`), one exported from a dirty tree, one whose format the client does not read, and one whose
shard folders do not hold the count its manifest claims. `--dry-run` prints what would be copied.

The export lands at `r2:ids-input-composer/<version>/`, and `versions.json` at the bucket root is
rewritten to list it first. `COMPOSER_BUCKET` names another bucket.

## Serving

`https://<worker>/<version>/<file>` is the export's own layout: `manifest.json`, `layout.json`,
`identity.json`, `g/…`, `p/…`, and the licence texts. A shard is gzip bytes under a `.json` name and goes out as
`application/octet-stream`, so nothing on the way unpacks or repacks it; everything else carries the
type its extension names. A version never changes once stored, so a file is cached for good, and one a
version lacks stays missing for five minutes. Any site may read them: `access-control-allow-origin: *`.

`https://<worker>/versions` lists the versions, newest first, read from the bucket on every request.

## Deploying the Worker

```sh
cd composer && bunx wrangler deploy
```

The bucket is `ids-input-composer`, bound as `COMPOSER` in `wrangler.jsonc`. `wrangler.jsonc` keeps
`workers_dev` on, so the Worker answers on its workers.dev address without a custom domain; add a route
when one is chosen.

## Reading it from another site

A version's URL is stable, so another site points at it directly. To follow the newest export instead,
read `/versions` and take the first entry. Nothing here requires the reader to be this project.

`glyph-atlas` keeps serving the exports it already holds at `/atlas/composer/`; an export published
here can replace one there once its readers point at this domain.
