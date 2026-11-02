# Before and after images

A change that alters a drawing shows the same cases, drawn the same way, before and after. The two images are made by one script from one case list, so a reader compares the change and not the framing.

## The rule

- **One case list.** Both images come from the same list of characters and descriptions, in the same order. A case missing from one side is a failure, not a smaller picture.
- **One renderer.** Both images use `scripts/render_before_after.mjs`, which draws every part of a composition over the others, so overlapping pieces show instead of being merged. A hand-made screenshot is not evidence for this comparison.
- **One frame.** Each drawing sits in the same square, at the same size, with the same margin. The export's own drawing of the character sits beside it, so the reader judges against the target rather than against memory.
- **Both themes.** Light and dark, from the same run.
- **The same build inputs.** The export, the fonts and the case list are pinned by the script; a before image made from a different export is not comparable.

## Making them

```sh
# before: the branch point
git worktree add /tmp/before origin/main
bun scripts/render_before_after.mjs --out /tmp/shots/before --cases cases.json

# after: the branch
bun scripts/render_before_after.mjs --out /tmp/shots/after --cases cases.json
```

`cases.json` is a list of `[label, description]` pairs. The script draws each description, and the character named by the label, from the pinned export.

## Checking them

`--check` compares two runs and fails when a case is missing from either side, when the case order differs, or when the two images differ in size. It does not judge the drawings; that is the reader's job.

```sh
bun scripts/render_before_after.mjs --check /tmp/shots/before /tmp/shots/after
```

## In a pull request

Push both images to the orphan `pr-assets` branch under `pr-<n>/` and embed them in a table, before above after, light and dark side by side. The pull request body states which cases the change reaches and which it leaves alone.
