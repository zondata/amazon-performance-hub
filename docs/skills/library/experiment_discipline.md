---
id: experiment_discipline
title: Experiment Discipline
version: 1.0.0
tags:
  - experiment
  - planning
  - evaluation
  - guardrails
applies_to:
  - planning
  - execution
  - evaluation
---

## SOP

### Group changes by profit impact direction
- **Waste reduction**: pause or reduce non-converting keywords/placements.
  Expected outcome: lower spend, stable or slightly lower sales, improved
  profit.
- **Efficiency improvement**: bid or modifier adjustments on proven
  converters. Expected outcome: similar sales at lower spend, or higher
  sales at similar spend.
- **Growth / expansion**: bid increases, new keywords, budget increases.
  Expected outcome: higher spend, higher sales, potentially higher ACOS
  short-term.
- Do not mix waste reduction and growth in the same experiment without
  placing them in separate `bulkgen_plans` with distinct `run_id` values.
  Mixed directions make attribution impossible.

### Predict the outcome
- Every experiment must include a specific, measurable predicted outcome.
  - Bad: "Improve profitability."
  - Good: "Reduce ad spend by ~$5-8/day from pausing 3 non-converting
    keywords, with <5% expected sales impact, resulting in ~$100-150
    profit improvement over the 14-day evaluation window."
- Include a confidence level: high-confidence (clear signal, predictable
  outcome) vs. exploratory (testing a hypothesis, uncertain outcome).
- The predicted outcome becomes the evaluation benchmark. If the AI
  cannot articulate a predicted outcome, the change is not ready to
  execute — move it to `kiv_items` with context on what additional data
  would clarify readiness.

### Size for evaluability
- Multiple changes are acceptable when they share a directional intent
  and can be evaluated as a group (e.g., reducing bids on 4 non-converting
  keywords in the same campaign is one coherent action).
- Avoid combining changes that affect the same KPI through different
  mechanisms in the same experiment (e.g., lowering a bid AND changing
  a placement modifier on the same campaign simultaneously).
- For larger change sets, use separate `run_id` groups within the
  experiment for internal attribution.

### Defer lower-confidence ideas
- Keep the immediate execution set focused on the highest-confidence
  changes: clearest signal, most predictable outcome.
- Move exploratory or uncertain ideas to `kiv_items` with context
  explaining what data or condition would confirm readiness.
- Re-evaluate top KIV items every analysis cycle. Promote them to
  execution when the evidence threshold is met.

### "Do nothing" as a valid experiment
- If the product is stable with no high-confidence optimization
  opportunities, the recommendation is a monitoring experiment:
  empty `bulkgen_plans`, observations and hypotheses captured in
  `kiv_items`.
- Optionally propose a bounded test: "If you want to try something,
  here is what I would test and why, with expected outcome X.
  Otherwise, continue monitoring."

### Evaluation mindset
- Before finalizing any plan, ask: "After the evaluation window, will
  I be able to tell whether this worked?" If the answer is no (too many
  confounding variables, unclear attribution, unmeasurable outcome),
  simplify the plan until the answer is yes.
- When evaluating completed experiments: compare actual KPI deltas
  against the predicted outcome. Score prediction accuracy, not just
  directional correctness.

## Why
The experiment system's value depends on evaluability. Twenty unrelated
changes produce unattributable results, preventing the system from
accumulating institutional knowledge. Structured experiments compound
learning over time.

## Risks if skipped
- Unevaluable experiments with ambiguous results that teach nothing.
- Compounding changes that mask each other's effects.
- Over-optimization: making changes for the sake of action rather than
  evidence.
