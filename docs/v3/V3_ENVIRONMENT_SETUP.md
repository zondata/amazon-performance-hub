# V3 Environment Setup

V3 worktree path:

/home/albert/code/amazon-performance-hub-v3

Branch:

v3/database-only

Current verified setup:

- Docker works in WSL.
- GitHub CLI is logged in.
- Git commit and push work from WSL.
- Codex CLI works inside the V3 worktree.
- Codex network access is enabled in .codex/config.toml.
- Supabase CLI is logged in.
- V3 worktree is linked to Supabase project: Amazon performance hub.
- Supabase cloud schema read works through:
  - supabase migration list
  - supabase db dump --schema public --data-only=false

Important rules:

- Do not run supabase db push unless explicitly approved.
- Do not run supabase db reset unless explicitly approved.
- Do not run supabase migration repair unless explicitly approved.
- Do not run destructive SQL unless explicitly approved.
- Codex may write local migration files and inspect schema.
- Codex may read Supabase cloud schema.
- Codex must not apply cloud migrations without explicit approval.

Known issue:

The old V2 migration chain does not start cleanly locally. Local supabase start failed at migration 014_latest_tiebreak.sql because placement_raw_norm was referenced before existing in the expected relation. V3 should not blindly inherit or apply the old V2 migration chain.
