from __future__ import annotations

import pytest

from app.seed import SeedData, load_seed


@pytest.fixture(scope="session")
def seed() -> SeedData:
    """The real seed bundle, loaded and validated once per test session."""
    data, _checks = load_seed()
    return data


@pytest.fixture(scope="session")
def checks():
    _data, results = load_seed()
    return results
