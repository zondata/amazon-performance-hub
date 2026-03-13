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

describe('ads optimizer config UI wiring', () => {
  it('loads config data only for the config view and renders the config manager', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("view === 'config' ? await getAdsOptimizerConfigViewData() : null");
    expect(source).toContain("view === 'config' && asin !== 'all' ? await findOptimizerProductByAsin(asin) : null");
    expect(source).toContain('await getProductOptimizerSettingsByProductId(selectedConfigProduct.productId)');
    expect(source).toContain('<OptimizerConfigManager');
    expect(source).toContain('createAdsOptimizerDraftVersionAction');
    expect(source).toContain('activateAdsOptimizerRulePackVersionAction');
    expect(source).toContain('saveAdsOptimizerDraftVersionAction');
    expect(source).toContain('saveAdsOptimizerProductSettingsAction');
    expect(source).toContain('seedAdsOptimizerStarterVersionsAction');
    expect(source).toContain('missingStarterProfiles={configData?.missingStarterProfiles ?? []}');
    expect(source).toContain('versionStrategyProfiles={configData?.versionStrategyProfiles ?? {}}');
  });

  it('wires server actions for draft creation, draft save, activation, starter seeding, and product settings save', () => {
    const source = fs.readFileSync(actionsPath, 'utf-8');

    expect(source).toContain('createRulePackVersionDraft');
    expect(source).toContain('updateRulePackVersionDraft');
    expect(source).toContain('activateRulePackVersion');
    expect(source).toContain('seedStarterRulePackVersionDrafts');
    expect(source).toContain('saveProductOptimizerSettings');
    expect(source).toContain('export async function saveAdsOptimizerDraftVersionAction');
    expect(source).toContain('export async function saveAdsOptimizerProductSettingsAction');
    expect(source).toContain('export async function seedAdsOptimizerStarterVersionsAction');
    expect(source).toContain("import { isRedirectError } from 'next/dist/client/components/redirect-error'");
    expect(source).toContain('const rethrowRedirectError = (error: unknown) => {');
    expect(source).toContain('rethrowRedirectError(error);');
    expect(source).toContain("redirectWithFlash(returnTo, {");
    expect(source).toContain("revalidatePath('/ads/optimizer')");
  });

  it('shows explicit config-only boundary messaging and selected-ASIN settings in the config manager', () => {
    const source = fs.readFileSync(managerPath, 'utf-8');

    expect(source).toContain('Configuration exists separately from execution');
    expect(source).toContain('Versioned rule-pack settings are live for manual runs.');
    expect(source).toContain('Structured draft editor');
    expect(source).toContain('Only drafts can be edited in place.');
    expect(source).toContain('JSON preview (read-only)');
    expect(source).toContain('Strategy profile for the selected ASIN');
    expect(source).toContain('Effective runtime version');
    expect(source).toContain('Assigned version profile');
    expect(source).toContain('Strategy mismatch warning');
    expect(source).toContain('Recommended for');
    expect(source).toContain('Starter versions');
    expect(source).toContain('Seed missing starter drafts');
    expect(source).toContain('Save product settings');
    expect(source).toContain('Visibility-led protects important targets more strongly');
    expect(source).toContain('Version history is append-only.');
  });
});
