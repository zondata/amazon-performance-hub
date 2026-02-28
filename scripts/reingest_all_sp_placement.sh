#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/d/Dropbox/AmazonReports"
ACCOUNT_ID="sourbear"

OUTDIR="./_reingest_logs"
mkdir -p "$OUTDIR"

OK_LOG="$OUTDIR/sp_placement_ok.log"
FAIL_LOG="$OUTDIR/sp_placement_fail.log"

echo "Starting SP placement re-ingest (force). Account: $ACCOUNT_ID" | tee -a "$OK_LOG"

mapfile -t FILES < <(find "$ROOT" -type f -iname "Sponsored_Products_Placement_report.xlsx" | sort)
echo "Found ${#FILES[@]} files." | tee -a "$OK_LOG"

for f in "${FILES[@]}"; do
  echo "----" | tee -a "$OK_LOG"
  echo "FILE: $f" | tee -a "$OK_LOG"

  set +e
  OUT=$(npm run reingest:sp:placement -- --account-id "$ACCOUNT_ID" "$f" --force 2>&1)
  CODE=$?
  set -e

  echo "$OUT" | tee -a "$OK_LOG"

  if [ $CODE -ne 0 ]; then
    echo "FAILED: $f" | tee -a "$FAIL_LOG"
    continue
  fi
done

echo "Done." | tee -a "$OK_LOG"
