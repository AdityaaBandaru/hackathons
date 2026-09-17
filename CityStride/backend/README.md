# Backend

FastAPI service for the World Cup 2026 Host-City Mobility Investment and
Legacy Optimizer. Phase 1 scope: in-memory seed loading with startup
validation, plus `GET /health`.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

`GET http://localhost:8000/health` reports the loaded record counts and the
number of integrity checks that passed.

## Test

```bash
pytest
```

## Data

`app/data/seed/` holds a copy of the verified bundle in `reference/json/`.
The reference directory is the raw evidence and is never modified.

The loader refuses to start the application if the bundle stops reconciling --
notably if the 11 official host allocations no longer total exactly
10,025,021,200 cents. Money is integer cents throughout; missing values stay
null and are never coerced to zero.
