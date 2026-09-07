# Getting Started — World Cup 2026 Mobility Optimizer

Everything below reflects what's already true on your Mac as of right now.

## What's already done for you

- Your data bundle was found at `~/Downloads/World_Cup_2026_Hackathon_Data_Bundle.zip`, already unzipped by macOS into `~/Downloads/World_Cup_2026_Hackathon_Data_Bundle/`.
- A clean project folder was created at:
  `~/projects/world-cup-mobility-optimizer/`
- The full verified bundle was copied into `reference/` inside that project (json/, csv/, geojson/, examples/, schemas/, scripts/, types/, the two xlsx workbooks, model_run.py, model_results.json, the runbook, and Research_and_Modeling_Task.md).
- `CLAUDE.md` was written at the project root — this is the steering file Claude Code reads automatically every session. It already points at the correct file paths (the filename mismatch between the runbook and the actual spec file is handled — CLAUDE.md references `reference/Research_and_Modeling_Task.md` directly).
- Git was initialized and the starting state was committed (`git log` shows one commit: "Initial setup").

You do not need to unzip anything, move anything, or create any folders yourself. That's done.

## "The Claude Code app" — what it actually is

You're reading this inside the Claude desktop app already. That same app has a tab called **Code** — that *is* Claude Code, just with a graphical interface instead of a typed terminal. You don't need to install anything separate. (Source: [code.claude.com/docs/en/desktop-quickstart](https://code.claude.com/docs/en/desktop-quickstart))

## Step 1 — Open the Code tab

1. Open the Claude app on your Mac (Applications → Claude, or Spotlight → "Claude").
2. Click **Code** at the top center of the window (next to Chat and Cowork).
3. If it asks you to sign in or upgrade, sign in with the same account as your Claude Pro subscription — Claude Code works with Pro, you don't need a separate API key. (Source: [code.claude.com/docs/en/authentication](https://code.claude.com/docs/en/authentication))

## Step 2 — Open your project

1. Choose **Local** as the environment (not Cloud, not SSH).
2. Click **Select folder**.
3. Navigate to: `projects` → `world-cup-mobility-optimizer` and select it.

## Step 3 — Choose a model

Click the model dropdown next to the send box. For Phase 1 (today), pick the **top-tier / "Opus-class"** model — the exact name shown may vary, pick whichever is labeled as the most capable/highest-tier option. (Phases 2 and 4 later can use the faster mid-tier model — see `reference/../Claude_Code_Implementation_Plan.md` sent earlier in chat for the full day-by-day reasoning.)

## Step 4 — Paste this as your very first message

```
Read reference/Research_and_Modeling_Task.md and reference/Claude_Code_Execution_Runbook.md completely.
Inspect every file in reference/json/ and reference/geojson/. Inspect reference/model_run.py and reference/model_results.json.

Implement Phase 1 only: repository foundation and seed loading. The JSON in reference/json/ is already normalized and validated — load it directly, do not write an xlsx ingestion pipeline.

Requirements:
1. Create backend/, frontend/, docs/ folders. Copy reference/json/*.json into backend/app/data/seed/.
2. Scaffold a FastAPI backend (no Docker, no PostgreSQL for this phase).
3. Add GET /health.
4. Write a Python seed-loading module that reads every JSON file into memory at startup.
5. Store money as integer cents everywhere.
6. Validate on load: 11 host regions, 143 funding rows, 22 pedestrian areas, 264 3D project records, 14 analog events, 768 ML rows, exact funding reconciliation to 10,025,021,200 cents, no duplicate IDs. Fail startup loudly if any check fails.
7. Add Pytest tests for the seed loader and the funding reconciliation.
8. Do not implement the optimizer, dashboard, or map yet.

Give a concise file-level plan first. Then implement. Run all tests and report exact commands, output, and files changed.
```

## Step 5 — Review and approve

- If your permission mode (dropdown near the send box) is set to **Manual**, Claude will show you a diff and ask before touching files — click through and approve.
- If it's set to **Accept edits**, files change automatically and you review the `+N -N` diff afterward.
- Either way, when it says it ran the tests, actually read the test output it shows you — don't just trust "tests passed" without seeing the pytest output.

## Step 6 — Commit, then move to Phase 2

Once Phase 1's tests genuinely pass, open the built-in terminal (Ctrl+` in the Code tab) or ask Claude Code itself to run:

```
git add . && git commit -m "phase 1: scaffold app and load verified seed data"
```

Then come back to `Claude_Code_Implementation_Plan.md` (already sent to you earlier in this chat) for the Phase 2, 3, 4, and 5 prompts — copy each one in, in order, one phase per day as scheduled there. Do not paste multiple phases at once.

## If anything here doesn't match what you see on screen

The Claude Code desktop app's exact button labels can change with app updates. If a button isn't where this doc says, look for the nearest equivalent (e.g. an "Open folder" vs "Select folder" wording difference) — the underlying flow (pick Local → pick your project folder → pick a model → type your request) stays the same.
