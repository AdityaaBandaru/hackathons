# Getting started

Requires Node.js 20.9+ and Python 3.11+. Unzip the project and open two terminals from its root.

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Backend (macOS/Linux):

```bash
cd backend
python -m venv .venv
./.venv/bin/pip install -e .
./.venv/bin/uvicorn app.main:app --port 8000
```

Open http://localhost:3000/map or http://localhost:3000/studio. Both services must be running. Run the optimizer before using scenario-only modes.

On Windows use `.venv\Scripts\python.exe -m pip install -e .` and `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`.

Validation:

```bash
cd frontend
npm run lint
npm test
npm run build
```

In backend, install test extras with `./.venv/bin/pip install -e '.[dev]'`, then run `./.venv/bin/python -m pytest`.

The frontend predev/pretest/prebuild step copies authoritative site context and GeoJSON byte-for-byte. Keep backend/ and reference/ beside frontend/. No geometry is regenerated. No API keys or map tile services are required.

See docs/phase-5-map.md for assumptions and verification. Live browser verification is incomplete.
