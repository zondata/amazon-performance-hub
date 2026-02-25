# Skills README

Skills are versioned SOP modules: small, reusable operational playbooks that define how a specific workflow should be executed.

## Purpose
- Keep repeatable workflows deterministic.
- Separate domain procedures from ad-hoc implementation details.
- Make changes auditable through explicit version updates.

## Versioning Rules
- Treat each skill as a module with a semantic version (`major.minor.patch`).
- Increase:
  - `major` for breaking workflow contract changes.
  - `minor` for backward-compatible capability additions.
  - `patch` for clarifications, typo fixes, or non-behavioral edits.

## Recommended Structure
- `goal`: what outcome the skill guarantees.
- `inputs`: required context and data dependencies.
- `procedure`: step-by-step SOP.
- `validation`: checks/tests required before completion.
- `outputs`: expected artifacts and contracts.
- `changelog`: dated summary of versioned updates.

## Usage
- Select the smallest skill that fully covers the task.
- Follow the skill contract before introducing custom steps.
- If a workflow cannot follow the skill exactly, document the deviation and why.
