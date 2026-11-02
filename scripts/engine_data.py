"""Where the engine's data lives now that it ships inside `@han-compose/composer`.

The outlines the browser composer draws without an export, and the coverage tables that say which
characters it draws, are the engine's files: they are built and read from the installed package.
The repository's own data — the IDS tables, the parts palette, the fonts' sources — stays in `data/`.
"""

import sys
from pathlib import Path

# The builders run as `python3 scripts/<name>.py` or `uv run scripts/<name>.py`: the folder comes
# first, so the helper beside them is found.
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "node_modules/@han-compose/composer"
DATA = ENGINE / "data"
