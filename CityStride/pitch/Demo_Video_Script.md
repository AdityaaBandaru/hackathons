# Demo Video Script — World Cup 2026 Host-City Mobility Optimizer

Target length: **3 minutes**. Devpost hackathons almost always cap the demo video (often at 3 minutes) — double-check the exact limit in this hackathon's official rules before you record, since going over can disqualify a submission outright. Everything below fits inside 3 minutes if you rehearse the click path once before recording — don't record cold.

Record the **actual running app** (backend + frontend both up, on your Mac, in a real browser) — not the pitch deck, not static screenshots. This is a demo of working software, and judges can tell the difference.

## Before you hit record

- Run both servers, confirm `/health` and the landing page load cleanly.
- Close other browser tabs and any bookmarks bar clutter. Full-screen the browser window.
- Zoom the browser to whatever size makes text legible in a recording (usually 100–110%).
- Rehearse the click path once, timed, so there's no dead air hunting for a button.
- Use QuickTime Player's screen recording (Mac, built in) or a tool you're comfortable with. Record system audio + mic if you're narrating live; otherwise record silent and voice over afterward.

## Shot-by-shot

**0:00–0:15 — Hook**
On camera or voiceover, over the landing page:
> "During a single World Cup match, host cities move more people through a fixed set of stations and roads than almost any other day of the year — and they only get to plan for it once. This is the tool we built to make that decision an evidence-based one."

**0:15–0:40 — The three pillars, fast**
Scroll the landing page. Point at the three cards (Compare all 11 host regions / City evidence / Run the optimizer).
> "It's three things working together: a validated evidence dataset for all 11 host regions, a real optimizer that decides what to build, and a map that shows exactly what was decided and why."

**0:40–1:20 — Evidence Engine**
Navigate to City Evidence → NY/NJ. Scroll to the Match #104 row.
> "Every number here is labeled — official plan, observed fact, or a disclosed engineering assumption. This match-day record — eighty thousand ticket holders, twenty-one thousand rail egress passengers — comes straight from NJ Transit's own after-action report, not an estimate."
Point at the `observed_final` badge and the source link.

**1:20–2:05 — Optimizer**
Navigate to Optimizer. Adjust one or two weight sliders (e.g. push emissions weight up).
> "This isn't a lookup table — it's a real mixed-integer optimizer. Change the priorities, and it recalculates the entire portfolio from scratch."
Click Run. Show the result: spend vs. budget, selected project count.
> "Eighteen projects selected, spending just under the region's actual budget — every dollar accounted for."
Briefly show the sensitivity panel changing.
Optional 10-second beat: dial a constraint to something impossible and show the infeasible state rendering a real explanation instead of an error page.
> "And if you ask for something impossible, it tells you exactly why — not just that it failed."

**2:05–2:40 — Legacy Map**
Navigate to Map. Click through Baseline → Temporary Operations → Selected Legacy → All Possibilities.
> "The map only ever shows what the optimizer actually chose. Baseline: nothing. Temporary operations for match day. What the city keeps permanently. And everything that was on the table, for comparison."
Click one project pin, show the card (name, phase, cost, evidence link).

**2:40–3:00 — Close**
Back on the landing page or a wide shot of the app.
> "Evidence in, optimization in the middle, an honest map out. Built for New York and New Jersey first, but the same chain works for all eleven World Cup 2026 host cities — and for whatever these cities plan next, after the tournament leaves."

## After recording

- Trim dead air at the start/end.
- Add simple captions if you have time — judges often watch muted first.
- Upload to YouTube or Vimeo as **unlisted** (not private — Devpost judges need to open it without a login), and test the link in an incognito window before submitting.
