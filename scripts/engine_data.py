"""Where the engine's files are read, and where they are built.

The outlines the browser composer draws without an export, and the coverage tables that say which
characters it draws, are the engine's files. Reading them from the installed package is right: that
is what the app draws from. Building them is not — `bun install` replaces an installed copy, and it
is nobody's source of truth. So a builder writes into a han-compose checkout, named by
`COMPOSER_REPO`, and refuses when it is not told which one.

The repository's own data — the IDS tables, the parts palette, the fonts' sources — stays in `data/`.
"""

import os
import sys
from pathlib import Path

# The builders run as `python3 scripts/<name>.py` or `uv run scripts/<name>.py`: the folder comes
# first, so the helper beside them is found.
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[1]

# Read: the installed package, which is what the app draws from.
PACKAGE = ROOT / "node_modules/@han-compose/composer"
DATA = PACKAGE / "data"


def _engine_repo() -> Path:
    named = os.environ.get("COMPOSER_REPO")
    if named:
        return Path(named).resolve()
    # Writing into a checkout nobody named could land in another branch's working tree, so the
    # candidates are only reported. Several exist on a machine that works in worktrees.
    found = []
    for base in ROOT.parents:
        found += [str(path) for path in [base / "han-compose", *sorted(base.glob("worktrees/han-compose*"))]
                  if (path / "src/han_compose/web_export.py").exists()]
    hint = "".join(f"\n  {path}" for path in dict.fromkeys(found))
    raise SystemExit(
        "This builder writes the engine's files into a han-compose checkout: set COMPOSER_REPO to one."
        + (f" Checkouts found:{hint}" if hint else "")
    )


ENGINE_REPO = _engine_repo()
# Write: the checkout that commits and publishes the engine's files.
WRITE_DATA = ENGINE_REPO / "data"
WRITE_SRC = ENGINE_REPO / "js/src"
