import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(
  process.cwd(),
  'apps/web/src/app/ads/optimizer/page.tsx'
);
const actionsPath = path.join(
  process.cwd(),
  'apps/web/src/app/ads/optimizer/actions.ts'
);
const managerPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerConfigManager.tsx'
);

describe('ads optimizer phase 2 UI wiring', () => {
  it('loads config data only for the config view and renders the config manager', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'config' ? await getAdsOptimizerConfigViewData() : null");
    expect(source).toContain("view === 'config' && asin !== 'all' ? await findOptimizerProductByAsin(asin) : null");
    expect(source).toContain('await getProductOptimizerSettingsByProductId(selectedConfigProduct.productId)');
    expect(source).toContain('<OptimizerConfigManager');
    expect(source).toContain('createAdsOptimizerDraftVersionAction');
    expect(source).toContain('activateAdsOptimizerRulePackVersionAction');
    expect(source).toContain('saveAdsOptimizerProductSettingsAction');
  });

  it('wires server actions for draft creation, activation, and product settings save', () => {
    const source = fs.readFileSync(actionsPath, 'utf-8');

    expect(source).toContain('createRulePackVersionDraft');
    expect(source).toContain('activateRulePackVersion');
    expect(source).toContain('saveProductOptimizerSettings');
    expect(source).toContain('export async function saveAdsOptimizerProductSettingsAction');
    expect(source).toContain("import { isRedirectError } from 'next/dist/client/components/redirect-error'");
    expect(source).toContain('const rethrowRedirectError = (error: unknown) => {');
    expect(source).toContain('rethrowRedirectError(error);');
    expect(source).toContain("redirectWithFlash(returnTo, {");
    expect(source).toContain("revalidatePath('/ads/optimizer')");
  });

  it('shows explicit config-only boundary messaging and selected-ASIN settings in the config manager', () => {
    const source = fs.readFileSync(managerPath, 'utf-8');

    expect(source).toContain('Configuration exists separately from execution');
    expect(source).toContain('No optimizer engine, scoring, target state machine, or draft handoff is running');
    expect(source).toContain('Strategy profile for the selected ASIN');
    expect(source).toContain('Save product settings');
    expect(source).toContain('Visibility-led protects important targets more strongly');
    expect(source).toContain('Version history is append-only.');
  });
});
