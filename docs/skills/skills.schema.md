# Skills v1 Schema

Skills are versioned SOP modules stored as Markdown in `docs/skills/library/`.

## File Location
- Path: `docs/skills/library/*.md`
- Reference key: skill IDs only.
- Runtime resolution: server loads Markdown content from repo files.

## Frontmatter (required)
Each skill file must start with YAML frontmatter containing:

```yaml
id: "string"                 # stable identifier used in DB/JSON
title: "string"              # human-readable label
version: "1.0.0"             # semver-ish version
tags: ["ops", "ads"]         # string[]
applies_to:                   # one or more workflow stages
  - analysis
  - planning
  - execution
  - evaluation
```

## Body Requirements
The Markdown body should stay practical and short, and include:
- SOP rules (what to do)
- Why the rule exists
- Risks/tradeoffs if skipped

## Usage Contract
- Product profile defaults: `product_profile.profile_json.skills: string[]`
- Experiment scope override/extension: `log_experiments.scope.skills: string[]`
- Storage format: IDs only (no embedded markdown in DB)
- Data packs: include both IDs and server-resolved content for each skill

## Validation Rules
- `id`, `title`, `version` must be non-empty strings.
- `tags` must be a string array.
- `applies_to` must be a string array containing only:
  - `analysis`
  - `planning`
  - `execution`
  - `evaluation`
- Unknown skill IDs must not break pack generation; include a deterministic missing-skill placeholder.
