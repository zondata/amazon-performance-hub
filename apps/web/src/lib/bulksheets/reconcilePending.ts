import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { env } from '@/lib/env';
type SpCreateManifest = {
  run_id: string;
  generator: string;
  created_at: string;
  campaigns: {
    name: string;
    temp_id?: string;
    portfolio_id?: string;
    campaign_id: string;
  }[];
  ad_groups: {
    campaign_name: string;
    ad_group_name: string;
    temp_id?: string;
    ad_group_id: string;
  }[];
  product_ads: {
    campaign_name: string;
    ad_group_name: string;
    sku?: string;
    asin?: string;
  }[];
  keywords: {
    campaign_name: string;
    ad_group_name: string;
    keyword_text: string;
    match_type: string;
    bid: number;
  }[];
};

const normText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, ' ');

export type PendingDirs = {
  baseDir: string;
  pendingDir: string;
  reconciledDir: string;
  failedDir: string;
};

export type ReconcileSummary = {
  reconciled: number;
  pending: number;
  failed: number;
  processed: number;
};

export type ReconcileResult = {
  run_id: string;
  generator: string;
  matched_at: string;
  campaign_matches: {
    campaign_name: string;
    campaign_id: string | null;
    matched: boolean;
  }[];
  ad_group_matches: {
    campaign_name: string;
    ad_group_name: string;
    ad_group_id: string | null;
    matched: boolean;
  }[];
  keyword_matches: {
    keyword_text: string;
    match_type: string;
    target_id: string | null;
    matched: boolean;
  }[];
  product_ad_matches: {
    campaign_name: string;
    ad_group_name: string;
    sku?: string;
    asin?: string;
    ad_id: string | null;
    matched: boolean;
    note?: string;
  }[];
  counts: {
    expected: number;
    matched: number;
    campaigns: { expected: number; matched: number };
    ad_groups: { expected: number; matched: number };
    keywords: { expected: number; matched: number };
    product_ads: { expected: number; matched: number };
  };
  all_matched: boolean;
};

type BulkCampaignRow = {
  campaign_id: string;
  campaign_name_raw: string;
  campaign_name_norm: string;
};

type BulkAdGroupRow = {
  ad_group_id: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  campaign_id: string;
};

type BulkTargetRow = {
  target_id: string;
  ad_group_id: string;
  expression_norm: string;
  match_type: string;
};

export const resolvePendingDirs = (pendingDir: string): PendingDirs => {
  const pendingPath = path.resolve(pendingDir);
  const candidate = path.join(pendingPath, '_PENDING_RECONCILE');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return {
      baseDir: pendingPath,
      pendingDir: candidate,
      reconciledDir: path.join(pendingPath, '_RECONCILED'),
      failedDir: path.join(pendingPath, '_FAILED'),
    };
  }
  const base = path.dirname(pendingPath);
  return {
    baseDir: base,
    pendingDir: pendingPath,
    reconciledDir: path.join(base, '_RECONCILED'),
    failedDir: path.join(base, '_FAILED'),
  };
};

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const listJsonFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.json'))
    .sort();
};

const basenameWithoutExt = (filePath: string): string => {
  const base = path.basename(filePath);
  return base.replace(/\.[^.]+$/, '');
};

const countExpected = (manifest: SpCreateManifest): number =>
  manifest.campaigns.length +
  manifest.ad_groups.length +
  manifest.product_ads.length +
  manifest.keywords.length;

const fetchBulkRows = async (snapshotDate: string) => {
  const { data: campaigns, error: campErr } = await supabaseAdmin
    .from('bulk_campaigns')
    .select('campaign_id,campaign_name_raw,campaign_name_norm')
    .eq('account_id', env.accountId)
    .eq('snapshot_date', snapshotDate);
  if (campErr) throw new Error(`Failed fetching bulk_campaigns: ${campErr.message}`);

  const { data: adGroups, error: adErr } = await supabaseAdmin
    .from('bulk_ad_groups')
    .select('ad_group_id,ad_group_name_raw,ad_group_name_norm,campaign_id')
    .eq('account_id', env.accountId)
    .eq('snapshot_date', snapshotDate);
  if (adErr) throw new Error(`Failed fetching bulk_ad_groups: ${adErr.message}`);

  const { data: targets, error: targetErr } = await supabaseAdmin
    .from('bulk_targets')
    .select('target_id,ad_group_id,expression_norm,match_type')
    .eq('account_id', env.accountId)
    .eq('snapshot_date', snapshotDate);
  if (targetErr) throw new Error(`Failed fetching bulk_targets: ${targetErr.message}`);

  return {
    campaigns: (campaigns ?? []) as BulkCampaignRow[],
    adGroups: (adGroups ?? []) as BulkAdGroupRow[],
    targets: (targets ?? []) as BulkTargetRow[],
  };
};

const reconcileManifest = (params: {
  manifest: SpCreateManifest;
  campaigns: BulkCampaignRow[];
  adGroups: BulkAdGroupRow[];
  targets: BulkTargetRow[];
}): ReconcileResult => {
  const { manifest, campaigns, adGroups, targets } = params;
  if (!manifest.run_id || !manifest.generator) {
    throw new Error('Manifest missing required fields: run_id and generator.');
  }

  const campaignByNorm = new Map<string, BulkCampaignRow>();
  campaigns.forEach((campaign) => {
    campaignByNorm.set(campaign.campaign_name_norm, campaign);
  });

  const adGroupByKey = new Map<string, BulkAdGroupRow>();
  adGroups.forEach((adGroup) => {
    const key = `${adGroup.campaign_id}::${adGroup.ad_group_name_norm}`;
    adGroupByKey.set(key, adGroup);
  });

  const campaignMatches = manifest.campaigns.map((campaign) => {
    const match = campaignByNorm.get(normText(campaign.name));
    return {
      campaign_name: campaign.name,
      campaign_id: match?.campaign_id ?? null,
      matched: Boolean(match),
    };
  });

  const adGroupMatches = manifest.ad_groups.map((adGroup) => {
    const campaign = campaignByNorm.get(normText(adGroup.campaign_name));
    const key = campaign ? `${campaign.campaign_id}::${normText(adGroup.ad_group_name)}` : '';
    const match = key ? adGroupByKey.get(key) : null;
    return {
      campaign_name: adGroup.campaign_name,
      ad_group_name: adGroup.ad_group_name,
      ad_group_id: match?.ad_group_id ?? null,
      matched: Boolean(match),
    };
  });

  const keywordMatches = manifest.keywords.map((keyword) => {
    const campaign = campaignByNorm.get(normText(keyword.campaign_name));
    const adGroupKey = campaign
      ? `${campaign.campaign_id}::${normText(keyword.ad_group_name)}`
      : '';
    const adGroup = adGroupKey ? adGroupByKey.get(adGroupKey) : null;
    const match = adGroup
      ? targets.find(
          (target) =>
            target.ad_group_id === adGroup.ad_group_id &&
            target.expression_norm === normText(keyword.keyword_text) &&
            target.match_type === keyword.match_type
        )
      : null;
    return {
      keyword_text: keyword.keyword_text,
      match_type: keyword.match_type,
      target_id: match?.target_id ?? null,
      matched: Boolean(match),
    };
  });

  const productAdMatches = manifest.product_ads.map((productAd) => {
    const campaign = campaignByNorm.get(normText(productAd.campaign_name));
    const adGroupKey = campaign
      ? `${campaign.campaign_id}::${normText(productAd.ad_group_name)}`
      : '';
    const adGroup = adGroupKey ? adGroupByKey.get(adGroupKey) : null;
    const matched = Boolean(adGroup);
    return {
      campaign_name: productAd.campaign_name,
      ad_group_name: productAd.ad_group_name,
      sku: productAd.sku,
      asin: productAd.asin,
      ad_id: null,
      matched,
      note: matched ? 'ad_id_unavailable' : 'missing_campaign_or_ad_group',
    };
  });

  const counts = {
    expected:
      manifest.campaigns.length +
      manifest.ad_groups.length +
      manifest.keywords.length +
      manifest.product_ads.length,
    matched:
      campaignMatches.filter((row) => row.matched).length +
      adGroupMatches.filter((row) => row.matched).length +
      keywordMatches.filter((row) => row.matched).length +
      productAdMatches.filter((row) => row.matched).length,
    campaigns: {
      expected: manifest.campaigns.length,
      matched: campaignMatches.filter((row) => row.matched).length,
    },
    ad_groups: {
      expected: manifest.ad_groups.length,
      matched: adGroupMatches.filter((row) => row.matched).length,
    },
    keywords: {
      expected: manifest.keywords.length,
      matched: keywordMatches.filter((row) => row.matched).length,
    },
    product_ads: {
      expected: manifest.product_ads.length,
      matched: productAdMatches.filter((row) => row.matched).length,
    },
  };

  return {
    run_id: manifest.run_id,
    generator: manifest.generator,
    matched_at: new Date().toISOString(),
    campaign_matches: campaignMatches,
    ad_group_matches: adGroupMatches,
    keyword_matches: keywordMatches,
    product_ad_matches: productAdMatches,
    counts,
    all_matched: counts.expected > 0 && counts.expected === counts.matched,
  };
};

export const processPendingManifests = async (params: {
  snapshotDate: string;
  pendingDir: string;
  maxManifests?: number;
  verbose?: boolean;
}): Promise<ReconcileSummary> => {
  const dirs = resolvePendingDirs(params.pendingDir);
  ensureDir(dirs.reconciledDir);
  ensureDir(dirs.failedDir);

  const files = listJsonFiles(dirs.pendingDir);
  const limited = params.maxManifests ? files.slice(0, params.maxManifests) : files;

  const { campaigns, adGroups, targets } = await fetchBulkRows(params.snapshotDate);

  let reconciled = 0;
  let pending = 0;
  let failed = 0;

  for (const fileName of limited) {
    const fullPath = path.join(dirs.pendingDir, fileName);
    let manifest: SpCreateManifest;

    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      manifest = JSON.parse(raw) as SpCreateManifest;
      if (!manifest.run_id || !manifest.generator) {
        throw new Error('Manifest missing required fields: run_id and generator.');
      }
    } catch (error) {
      failed += 1;
      const failData = {
        error: (error as Error).message,
        stack: (error as Error).stack ?? null,
      };
      const base = basenameWithoutExt(fullPath);
      fs.writeFileSync(
        path.join(dirs.failedDir, `${base}.fail.json`),
        `${JSON.stringify(failData, null, 2)}\n`,
        'utf-8'
      );
      fs.renameSync(fullPath, path.join(dirs.failedDir, fileName));
      continue;
    }

    let result: ReconcileResult;
    try {
      result = reconcileManifest({ manifest, campaigns, adGroups, targets });
    } catch (error) {
      failed += 1;
      const failData = {
        error: (error as Error).message,
        stack: (error as Error).stack ?? null,
      };
      const base = basenameWithoutExt(fullPath);
      fs.writeFileSync(
        path.join(dirs.failedDir, `${base}.fail.json`),
        `${JSON.stringify(failData, null, 2)}\n`,
        'utf-8'
      );
      fs.renameSync(fullPath, path.join(dirs.failedDir, fileName));
      continue;
    }

    if (result.all_matched) {
      reconciled += 1;
      const reconcilePayload = {
        run_id: result.run_id,
        account_id: env.accountId,
        snapshot_date: params.snapshotDate,
        matched_at: result.matched_at,
        matches: result,
      };
      const base = basenameWithoutExt(fullPath);
      fs.writeFileSync(
        path.join(dirs.reconciledDir, `${base}.reconcile_result.json`),
        `${JSON.stringify(reconcilePayload, null, 2)}\n`,
        'utf-8'
      );
      fs.renameSync(fullPath, path.join(dirs.reconciledDir, fileName));
      continue;
    }

    pending += 1;
    if (params.verbose) {
      const expected = countExpected(manifest);
      const matched = result.counts.matched;
      console.log(`PENDING ${fileName} (${matched}/${expected})`);
    }
  }

  return {
    reconciled,
    pending,
    failed,
    processed: limited.length,
  };
};

export const listManifestFiles = (dir?: string) => {
  if (!dir) return [] as { name: string; mtime: string }[];
  if (!fs.existsSync(dir)) return [];
  return listJsonFiles(dir).map((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    return { name: file, mtime: stat.mtime.toISOString() };
  });
};
