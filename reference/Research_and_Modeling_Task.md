# Research + Modeling Task: FIFA World Cup 2026 Host City Mobility Investment Optimizer

I am developing a hackathon project for a sustainability/urban mobility challenge focused on FIFA World Cup 2026 host cities.

## Core Problem

We want to build a **FIFA Mobility Investment Optimizer** that answers:

> **Given a fixed amount of transportation funding available to a FIFA World Cup 2026 host city, what combination of transportation interventions will produce the maximum measurable benefit in congestion reduction, travel-time reduction, emissions reduction, transit reliability/capacity, and first/last-mile accessibility?**

The model must be **city-specific** rather than applying the same recommendation to every city.

The 11 U.S. FIFA World Cup 2026 host cities are:

1. Atlanta
2. Boston
3. Dallas
4. Houston
5. Kansas City
6. Los Angeles
7. Miami
8. New York/New Jersey
9. Philadelphia
10. San Francisco Bay Area
11. Seattle

---

# PART 1 — Find the REAL budgets

Research the transportation/mobility-related funding available for the 2026 World Cup for **each of the 11 U.S. host cities**.

This is extremely important:

### DO NOT invent or estimate a World Cup transportation budget and present it as fact.

For each city, distinguish between:

### A. World Cup-specific city funding

Money explicitly appropriated/allocated by the city for World Cup hosting.

### B. World Cup-specific transportation funding

Money explicitly allocated for:

- transit
- roads
- traffic management
- shuttles
- pedestrian infrastructure
- mobility
- transportation operations
- transportation security
- accessibility

### C. State funding

World Cup-related transportation funding provided by the state.

### D. Federal funding

World Cup-related federal transportation grants/support.

### E. Transit agency funding

World Cup-specific spending by agencies such as MARTA, METRO, DART, NJ Transit, SEPTA, VTA, Sound Transit, etc.

### F. General transportation infrastructure

Projects that benefit the World Cup but were NOT specifically funded for the World Cup.

Do NOT combine these categories.

For every number, determine exactly what the money can legally/administratively be used for.

---

# PART 2 — Build a verified budget table

Create a table with:

| Host CityStadiumMatchesCity World Cup FundingWorld Cup Transportation FundingState FundingFederal FundingTransit Agency FundingGeneral Transportation FundingBest Defensible Optimization Budget |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

For the **Best Defensible Optimization Budget**, explain which funding pool we should actually use as the constraint in our optimization model.

If no city has a clearly identifiable transportation-only World Cup budget, explicitly say:

> "No single transportation budget was publicly identified."

Then construct a defensible budget envelope using the most directly relevant funding sources.

Do not silently combine unrelated funds.

---

# PART 3 — PRIMARY SOURCES ONLY FOR FUNDING

Prioritize sources in this order:

1. City government documents
2. City council legislation/resolutions
3. Municipal budgets
4. Transit agency board documents/budgets
5. State government documents
6. Federal government documents
7. Official FIFA/local organizing committee documents
8. Government press releases

Use news organizations only to supplement primary sources when necessary.

For EVERY budget number provide:

- exact amount
- fiscal year
- date
- government/agency
- what the funding is for
- whether it is World Cup-specific
- whether it is transportation-specific
- whether it is cash, in-kind, bond financing, grant funding, or another category
- source
- direct link
- citation

If different sources report different numbers, investigate why rather than choosing one arbitrarily.

---

# PART 4 — Research each city's transportation system

For each city, collect the variables that should influence transportation investment.

At minimum:

### Demand

- Expected World Cup attendance
- Number of matches
- Stadium capacity
- Expected visitors
- Visitor origin distribution if available
- Hotel concentrations
- Airport passenger demand
- Downtown/central business district concentration

### Transportation supply

- Rail capacity
- Bus capacity
- Transit frequency
- Number of transit stations near stadium
- Road capacity
- Existing dedicated bus lanes
- Parking capacity
- Park-and-ride capacity
- Pedestrian infrastructure
- Bicycle infrastructure
- Rideshare infrastructure

### Baseline conditions

- Typical congestion
- Match-day congestion if historical events are available
- Average travel time
- Transit travel time
- First/last-mile walking distance
- Existing transportation bottlenecks
- Mode share
- Transportation emissions

Find quantitative data wherever possible.

---

# PART 5 — Define the intervention library

Create a realistic intervention library that a city could actually deploy before/during FIFA 2026.

Start with:

1. Additional shuttle buses
2. Increased transit frequency
3. Temporary dedicated bus lanes
4. Traffic signal optimization
5. Park-and-ride facilities
6. Temporary pedestrian corridors
7. Temporary protected bicycle infrastructure
8. Rideshare pickup/drop-off hubs
9. Transit station capacity improvements
10. Dynamic traffic management
11. Event-specific wayfinding
12. First/last-mile shuttle connections

For each intervention, research realistic costs.

Create:

| InterventionUnitLow CostTypical CostHigh CostCapacity/ImpactSource |
| ------------------------------------------------------------------ |

Do NOT simply invent costs.

Use transportation agencies, government project costs, DOT documents, peer-reviewed research, or credible transportation studies.

Normalize costs to **2026 USD** where possible.

Explain assumptions.

---

# PART 6 — Build the mathematical optimization model

Design a model that maximizes the benefit produced by each city's limited transportation budget.

The basic formulation should be:

```math
\max_x B(x)
```

subject to:

```math
\sum_i C_i x_i \leq B_{city}
```

where:

- `x_i` = amount of intervention i
- `C_i` = cost of intervention i
- `B_{city}` = defensible city-specific transportation budget
- `B(x)` = total transportation/sustainability benefit

The objective should incorporate:

### 1. Travel-time reduction

```math
BT = \sum_j Demand_j(Time_{baseline,j}-Time_{scenario,j})
```

### 2. Congestion reduction

```math
BC = \sum_j Stress_{baseline,j}-Stress_{scenario,j}
```

where:

```math
Stress_j=\frac{Demand_j}{Capacity_j}
```

### 3. Emissions reduction

```math
BE=CO_{2,baseline}-CO_{2,scenario}
```

### 4. Accessibility improvement

Measure improvement in:

- travel time
- walking distance
- transfers
- transit frequency
- access to stadium

### 5. Reliability/resilience

Measure reduction in the probability or severity of transportation overload.

---

# PART 7 — Account for diminishing returns

Do NOT assume that adding 100 buses gives exactly 5× the benefit of adding 20 buses.

Model diminishing returns.

For example:

```math
Benefit(x)=A(1-e^{-kx})
```

Research reasonable functional forms and parameters from transportation literature.

Explain how we could calibrate these parameters using historical event data.

---

# PART 8 — Account for intervention interactions

This is critical.

Some interventions are complementary.

For example:

- More buses + dedicated bus lanes
- Increased rail frequency + station improvements
- Park-and-ride + shuttle service
- Traffic signal optimization + transit priority

Therefore:

```math
Benefit(A+B)\neq Benefit(A)+Benefit(B)
```

Build a method for representing these interactions.

Explain whether the best approach for our hackathon MVP is:

- MILP
- Mixed-integer nonlinear programming
- Integer programming
- Bayesian optimization
- Genetic algorithm
- Reinforcement learning
- another method

Choose ONE primary method and explain why.

Prioritize something we can actually implement in Python during a hackathon.

---

# PART 9 — Make the model city-specific

For every host city, create a city profile.

Example:

```math
CityProfile= \{ Budget, Attendance, Matches, TransitCapacity, RoadCapacity, ModeShare, VisitorOrigins, HotelDistribution, EmissionFactors, BaselineCongestion \}
```

Then explain exactly how the optimization model changes based on these parameters.

Do NOT give generic recommendations.

For each city, determine which interventions are likely to have the highest marginal benefit based on its actual transportation characteristics.

---

# PART 10 — Determine the "next dollar" of investment

This is one of the most important features of the project.

The platform should calculate:

```math
MarginalBenefit_i= \frac{\Delta Benefit}{\Delta Cost}
```

For every intervention.

Then answer:

> **"If this city receives another $1 million, where should that money go?"**

And:

> **"At what point does additional spending stop producing meaningful benefit?"**

Create a concept for a **marginal benefit curve** for every city.

---

# PART 11 — Generate an optimized portfolio for each city

For each of the 11 cities, produce a hypothetical optimization using the best defensible budget.

Example format:

### Houston

Budget: $X

| InterventionQuantityCostTravel-Time BenefitCongestion BenefitCO₂ Benefit |                 |    |   |   |   |
| ------------------------------------------------------------------------ | --------------- | -- | - | - | - |
| Shuttle buses                                                            | X               | $X | X | X | X |
| Bus lanes                                                                | X miles         | $X | X | X | X |
| Signal optimization                                                      | X intersections | $X | X | X | X |

Then calculate:

- Total cost
- Remaining budget
- Travel-time reduction
- Congestion reduction
- CO₂ reduction
- Accessibility improvement
- Transit overload reduction
- Benefit per dollar

Do this for ALL 11 cities.

Clearly label anything that is modeled/estimated rather than directly observed.

---

# PART 12 — Build a cross-city comparison

Create:

| CityBudgetOptimal StrategyCostCongestion ↓Travel Time ↓CO₂ ↓Accessibility ↑Benefit/$ |
| ------------------------------------------------------------------------------------ |

Then determine:

1. Which city gets the highest benefit per dollar?
2. Which city has the largest transportation risk?
3. Which city has the greatest marginal value from additional spending?
4. Which city is most transit-constrained?
5. Which city is most road-constrained?
6. Which city has the largest first/last-mile problem?
7. Which city has the greatest potential emissions reduction?
8. Which interventions are consistently selected?
9. Which interventions are highly city-specific?

---

# PART 13 — Sensitivity analysis

Test what happens if assumptions are wrong.

At minimum:

### Attendance

- 80% expected attendance
- 100%
- 120%

### Visitor transit usage

- Low
- Medium
- High

### Budget

- -25%
- baseline
- +25%

### Intervention costs

- -20%
- baseline
- +20%

### Transit capacity

- -20%
- baseline
- +20%

Determine whether the optimal investment portfolio changes.

This is important because we don't want a model that only works under one set of assumptions.

---

# PART 14 — Tell me what data we actually need for the MVP

Separate data into:

### MUST HAVE

Data required to make the optimization credible.

### NICE TO HAVE

Data that would improve accuracy but isn't necessary.

### CAN BE SIMULATED

Variables where we can create reasonable synthetic data for a hackathon demonstration.

For every dataset provide:

- Dataset name
- Variable
- Geographic resolution
- Temporal resolution
- Source
- API/download availability
- License/accessibility
- Why we need it

Prioritize open government datasets.

---

# PART 15 — Design the actual hackathon MVP

After completing the research, give me a concrete implementation plan.

We have limited hackathon time.

Design an MVP with:

### Frontend

Recommended framework.

### Backend

Recommended architecture.

### Database

Recommended data structure.

### Optimization

Exact Python libraries.

### Mapping

Recommended mapping library.

### Visualization

Recommended charting library.

### Data pipeline

Exact flow from raw data → model → optimization → dashboard.

---

# PART 16 — Recommended MVP scope

Do NOT recommend building all 11 cities first.

Determine:

1. Which city should be our flagship demonstration city?
2. Why?
3. Which second city would best demonstrate that the model generalizes?
4. What minimum number of interventions should we implement?
5. What minimum datasets are needed?
6. What can be simulated?

Then create a **48-hour/2-day hackathon implementation plan**.

---

# PART 17 — Final deliverable

At the end, give me a concise but technically rigorous project specification containing:

## 1. Problem statement

One paragraph.

## 2. Product concept

One paragraph.

## 3. Optimization objective

Mathematical formulation.

## 4. Decision variables

List them.

## 5. Constraints

List them.

## 6. Benefit functions

List them.

## 7. City-specific parameters

List them.

## 8. Intervention costs

Table.

## 9. Verified city budgets

Table with citations.

## 10. Recommended optimized portfolios

One for each city.

## 11. MVP architecture

Diagram/description.

## 12. Data sources

Complete source table.

## 13. Hackathon implementation plan

Day-by-day/hour-by-hour.

## 14. What makes this solution competitive

Explain why this is meaningfully better than a normal transportation dashboard.

---

# CRITICAL RESEARCH RULES

- Use web research extensively.
- Prefer primary government/agency sources.
- Cite every factual budget number.
- Never fabricate a budget.
- Clearly distinguish confirmed numbers from estimates.
- Clearly distinguish observed data from modeled data.
- Use 2026 USD when possible.
- Do not treat general infrastructure spending as World Cup funding unless the source explicitly connects it to the World Cup.
- If a city's transportation budget cannot be isolated, say so and construct a transparent defensible budget envelope.
- Do not hide uncertainty.
- Give direct source links.
- Use actual quantitative data whenever possible.
- Where data is unavailable, propose a defensible proxy and explain it.
- The final model must be implementable in Python.
- Optimize for **maximum measurable benefit per dollar**, not simply maximum total spending.
- The ultimate output should allow a city decision-maker to answer:

> **"I have $X million. Where should I spend it to get the largest measurable improvement in World Cup mobility?"**

Do the research first, then construct the model. Do not jump directly to a generic solution.