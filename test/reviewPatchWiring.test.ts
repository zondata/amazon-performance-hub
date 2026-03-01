import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const importReviewPatchPackPath = path.join(
  process.cwd(),
  'apps/web/src/lib/logbook/aiPack/importReviewPatchPack.ts'
);
const reviewPatchRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/review-patch-pack/route.ts'
);
const finalizePlanRoutePath = path.join(
  process.cwd(),
  'apps/web/src/app/logbook/experiments/[id]/finalize-plan/route.ts'
);
const productPagePath = path.join(
  process.cwd(),
  'apps/web/src/app/products/[asin]/page.tsx'
);
const runGeneratorsPath = path.join(
  process.cwd(),
  'apps/web/src/lib/bulksheets/runGenerators.ts'
);

describe('review patch v1 wiring', () => {
  it('stores review_patch + final_plan in experiment scope and moves status to REVIEWED', () => {
    const source = fs.readFileSync(importReviewPatchPackPath, 'utf-8');
    expect(source).toContain('review_patch');
    expect(source).toContain('final_plan');
    expect(source).toContain("status: 'REVIEWED'");
  });

  it('exposes review patch download/upload route and finalize route', () => {
    const uploadSource = fs.readFileSync(reviewPatchRoutePath, 'utf-8');
    const finalizeSource = fs.readFileSync(finalizePlanRoutePath, 'utf-8');
    expect(uploadSource).toContain('export async function GET');
    expect(uploadSource).toContain('export async function POST');
    expect(uploadSource).toContain('importReviewPatchPack');
    expect(finalizeSource).toContain("status: 'FINALIZED'");
  });

  it('gates product bulksheet generation by preferring final plan selection', () => {
    const source = fs.readFileSync(productPagePath, 'utf-8');
    expect(source).toContain('selectBulkgenPlansForExecution');
    expect(source).toContain("selection.source === 'proposal'");
    expect(source).toContain('final_plan_pack_id');
  });

  it('passes final_plan_pack_id into generated changes payload', () => {
    const source = fs.readFileSync(runGeneratorsPath, 'utf-8');
    expect(source).toContain('finalPlanPackId?: string | null');
    expect(source).toContain('final_plan_pack_id: payload.finalPlanPackId ?? undefined');
  });
});
