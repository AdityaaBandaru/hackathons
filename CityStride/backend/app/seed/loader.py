"""Reads the seed JSON into memory once, then validates it.

There is no database in v1 (CLAUDE.md rule 15). The whole bundle is small --
264 project records, 143 funding rows, 768 synthetic ML rows -- so it is parsed
at startup and held read-only for the process lifetime.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from types import MappingProxyType
from typing import Any

from ..config import SEED_DIR, SEED_FILES
from .schema import SeedData, freeze_records
from .validation import CheckResult, SeedValidationError, validate_seed

logger = logging.getLogger(__name__)

# These two seed files are JSON objects, not arrays.
_MAPPING_DATASETS = frozenset({"legacyProjectAliases", "nynjHackathonContext"})


class SeedLoadError(RuntimeError):
    """Raised when a seed file is missing or unparseable."""


def _read_json(path: Path) -> Any:
    if not path.is_file():
        raise SeedLoadError(f"seed file not found: {path}")
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise SeedLoadError(f"seed file is not valid JSON: {path} ({exc})") from exc


def load_seed(
    seed_dir: Path | None = None, *, validate: bool = True
) -> tuple[SeedData, tuple[CheckResult, ...]]:
    """Load and validate every seed dataset.

    Returns the immutable :class:`SeedData` and the list of checks that ran.
    Raises :class:`SeedLoadError` if a file is missing or malformed, and
    :class:`SeedValidationError` if the data loads but fails an integrity check.
    """
    directory = Path(seed_dir) if seed_dir is not None else SEED_DIR
    datasets: dict[str, Any] = {}

    for name, filename in SEED_FILES.items():
        raw = _read_json(directory / filename)
        if name in _MAPPING_DATASETS:
            if not isinstance(raw, dict):
                raise SeedLoadError(f"{filename} must be a JSON object")
            datasets[name] = MappingProxyType(raw)
        else:
            if not isinstance(raw, list):
                raise SeedLoadError(f"{filename} must be a JSON array")
            datasets[name] = freeze_records(raw, filename)

    seed = SeedData(**datasets)

    if not validate:
        logger.warning("seed loaded with validation disabled; do not do this in serving")
        return seed, ()

    results = validate_seed(seed)
    logger.info(
        "seed loaded from %s: %d datasets, %d integrity checks passed",
        directory,
        len(datasets),
        len(results),
    )
    return seed, results


__all__ = [
    "CheckResult",
    "SeedLoadError",
    "SeedValidationError",
    "load_seed",
]
