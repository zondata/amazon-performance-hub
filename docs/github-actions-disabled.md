# GitHub Actions Disabled

Date of disablement: 2026-05-09

Reason: Amazon Performance Hub V1, V2, and V3 GitHub Actions were intentionally stopped.

Scope: repo-level workflow disablement plus branch-level workflow file neutralization.

Restore instructions:
1. Re-enable the required workflow using `gh workflow enable`.
2. Move the needed files from `.github/workflows.disabled/` back to `.github/workflows/`.
3. Commit and push only on the intended branch.

Warning: do not re-enable Amazon data sync workflows unless the operator confirms the correct account, marketplace, credentials, and desired data window.
