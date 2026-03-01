import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import KpiCards from '@/components/KpiCards';
import KeywordGroupImport from '@/components/KeywordGroupImport';
import KeywordGroupSetManager from '@/components/KeywordGroupSetManager';
import Tabs from '@/components/Tabs';
import TrendChart from '@/components/TrendChart';
import KeywordAiPackDownload from '@/components/keywords/KeywordAiPackDownload';
import ProductExperimentPromptPackDownload from '@/components/logbook/ProductExperimentPromptPackDownload';
import ExperimentEvaluationOutputPackImport from '@/components/logbook/ExperimentEvaluationOutputPackImport';
import ProductDriverIntentManager from '@/components/logbook/ProductDriverIntentManager';
import ProductKivBacklogManager from '@/components/logbook/ProductKivBacklogManager';
import ProductBaselineDataPackDownload from '@/components/logbook/ProductBaselineDataPackDownload';
import ProductLogbookAiPackImport from '@/components/logbook/ProductLogbookAiPackImport';
import ProductProfileSkillsIntentEditor from '@/components/logbook/ProductProfileSkillsIntentEditor';
import ProductRankingHeatmap from '@/components/ranking/ProductRankingHeatmap';
import ProductSqpTable from '@/components/sqp/ProductSqpTable';
import { runSbUpdateGenerator, runSpUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import { downloadTemplateToLocalPath } from '@/lib/bulksheets/templateStore';
import { parseCsv } from '@/lib/csv/parseCsv';
import { env } from '@/lib/env';
import { getKeywordAiPackTemplates } from '@/lib/keywords/keywordAiPackTemplates';
import { toTemplateOptions as toKeywordTemplateOptions } from '@/lib/keywords/keywordAiPackTemplatesModel';
import { importProductExperimentOutputPack } from '@/lib/logbook/aiPack/importProductExperimentOutputPack';
import { getProductExperimentPromptTemplates } from '@/lib/logbook/productExperimentPromptTemplates';
import { toTemplateOptions as toProductExperimentPromptTemplateOptions } from '@/lib/logbook/productExperimentPromptTemplatesModel';
import {
  buildPlanPreviewsForScope,
  PlanPreview,
} from '@/lib/logbook/productExperimentPlans';
import { selectBulkgenPlansForExecution } from '@/lib/logbook/contracts/reviewPatchPlan';
import {
  getOutcomePillClassName,
  normalizeOutcomeScorePercent,
} from '@/lib/logbook/outcomePill';
import { runManualBulkgenValidation } from '@/lib/logbook/runBulkgenValidation';
import { deriveKivCarryForward } from '@/lib/logbook/kiv';
import { ensureProductId } from '@/lib/products/ensureProductId';
import { getProductDetailData } from '@/lib/products/getProductDetailData';
import type {
  ProductChangesExplorerFilters,
  ProductChangesExplorerRow,
} from '@/lib/products/buildProductChangesExplorerViewModel';
import { getProductChangesExplorerData } from '@/lib/products/getProductChangesExplorerData';
import { getProductKeywordGroups } from '@/lib/products/getProductKeywordGroups';
import { getProductKeywordGroupMemberships } from '@/lib/products/getProductKeywordGroupMemberships';
import { getProductLogbookData } from '@/lib/products/getProductLogbookData';
import { getProductRankingDaily } from '@/lib/ranking/getProductRankingDaily';
import { getProductSqpWeekly } from '@/lib/sqp/getProductSqpWeekly';
import { getProductSqpTrendSeries } from '@/lib/sqp/getProductSqpTrendSeries';
import { listResolvedSkills, resolveSkillsByIds } from '@/lib/skills/resolveSkills';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '—';
  if (!DATE_RE.test(value)) return value;
  return value;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const scopeString = (scope: Record<string, unknown> | null, key: string) => {
  if (!scope) return null;
  const value = scope[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const scopeStringArray = (scope: Record<string, unknown> | null, key: string) => {
  if (!scope) return [];
  const value = scope[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const extractEvaluationSummary = (metricsJson: unknown): string | null => {
  const metrics = asObject(metricsJson);
  return metrics ? scopeString(metrics, 'summary') : null;
};

const extractEvaluationOutcome = (metricsJson: unknown) => {
  const metrics = asObject(metricsJson);
  const outcome = asObject(metrics?.outcome);
  if (!outcome) return null;
  const scoreRaw = outcome.score;
  const score =
    typeof scoreRaw === 'number'
      ? scoreRaw
      : typeof scoreRaw === 'string'
        ? Number(scoreRaw)
        : NaN;
  const normalized = Number.isFinite(score) ? normalizeOutcomeScorePercent(score) : null;
  return {
    score: normalized,
    label: scopeString(outcome, 'label'),
    confidence:
      typeof outcome.confidence === 'number'
        ? outcome.confidence
        : typeof outcome.confidence === 'string'
          ? Number(outcome.confidence)
          : null,
  };
};

const formatOutcomePercent = (score: number | null): string => {
  const normalized = normalizeOutcomeScorePercent(score);
  if (normalized === null) return '—';
  return `${normalized.toFixed(0)}%`;
};

const normalizeDriverChannel = (value: unknown): 'sp' | 'sb' | 'sd' => {
  if (typeof value !== 'string') return 'sp';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'sb') return 'sb';
  if (normalized === 'sd') return 'sd';
  return 'sp';
};

const normalizeKivStatus = (value: unknown): 'open' | 'done' | 'dismissed' => {
  if (typeof value !== 'string') return 'open';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'done') return 'done';
  if (normalized === 'dismissed') return 'dismissed';
  return 'open';
};

const formatEntityDetails = (entity: {
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
}) => {
  const parts: string[] = [];
  if (entity.product_id) parts.push(`Product ${entity.product_id}`);
  if (entity.campaign_id) parts.push(`Campaign ${entity.campaign_id}`);
  if (entity.ad_group_id) parts.push(`Ad group ${entity.ad_group_id}`);
  if (entity.target_id) parts.push(`Target ${entity.target_id}`);
  if (entity.keyword_id) parts.push(`Keyword ${entity.keyword_id}`);
  return parts;
};

const formatUnknownJson = (value: unknown) => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toDisplayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

const validationToneClass = (status: string) => {
  if (status === 'validated') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'mismatch') return 'border-rose-300 bg-rose-50 text-rose-700';
  if (status === 'not_found') return 'border-amber-300 bg-amber-50 text-amber-700';
  return 'border-border bg-surface-2 text-muted';
};

const CHANGES_CHANNEL_FILTERS = new Set(['all', 'sp', 'sb', 'sd', 'non_ads']);
const CHANGES_SOURCE_FILTERS = new Set(['all', 'bulkgen', 'manual']);
const CHANGES_VALIDATION_FILTERS = new Set([
  'all',
  'pending',
  'validated',
  'mismatch',
  'not_found',
  'none',
]);

const normalizeChangesChannelFilter = (
  value?: string
): ProductChangesExplorerFilters['channel'] => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!CHANGES_CHANNEL_FILTERS.has(normalized)) return 'all';
  return normalized as ProductChangesExplorerFilters['channel'];
};

const normalizeChangesSourceFilter = (
  value?: string
): ProductChangesExplorerFilters['source'] => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!CHANGES_SOURCE_FILTERS.has(normalized)) return 'all';
  return normalized as ProductChangesExplorerFilters['source'];
};

const normalizeChangesValidationFilter = (
  value?: string
): ProductChangesExplorerFilters['validation'] => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!CHANGES_VALIDATION_FILTERS.has(normalized)) return 'all';
  return normalized as ProductChangesExplorerFilters['validation'];
};

const toDiffLabel = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (value) => value.toUpperCase());

const stringifyUnknown = (value: unknown) => {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildChangeDiffLines = (change: ProductChangesExplorerRow['change']) => {
  const before = asObject(change.before_json);
  const after = asObject(change.after_json);
  if (!before && !after) return [] as string[];

  const lines: string[] = [];
  const seenKeys = new Set<string>();
  const addLine = (key: string, label?: string) => {
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    if (beforeValue === undefined && afterValue === undefined) return;
    if (stringifyUnknown(beforeValue) === stringifyUnknown(afterValue)) return;
    lines.push(`${label ?? toDiffLabel(key)}: ${toDisplayValue(beforeValue)} -> ${toDisplayValue(afterValue)}`);
  };

  const changeType = change.change_type.toLowerCase();
  if (changeType.includes('budget')) {
    addLine('daily_budget', 'Daily Budget');
    addLine('budget', 'Budget');
    addLine('new_budget', 'New Budget');
  }
  if (changeType.includes('bid')) {
    addLine('bid', 'Bid');
    addLine('new_bid', 'New Bid');
  }
  if (changeType.includes('placement')) {
    addLine('placement_code', 'Placement Code');
    addLine('placement_raw', 'Placement');
    addLine('percentage', 'Placement %');
    addLine('new_pct', 'New Placement %');
  }
  if (
    changeType.includes('state') ||
    changeType.includes('pause') ||
    changeType.includes('enable')
  ) {
    addLine('state', 'State');
    addLine('status', 'Status');
  }
  addLine('run_id', 'Run ID');

  if (lines.length === 0) {
    const keys = new Set<string>([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]);
    for (const key of Array.from(keys).sort((left, right) => left.localeCompare(right))) {
      if (key === 'run_id') continue;
      addLine(key);
      if (lines.length >= 8) break;
    }
  }

  return lines;
};

const formatEntityCompact = (entity: {
  entity_type: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
}) => {
  const parts = formatEntityDetails(entity);
  return `${entity.entity_type}: ${parts.length > 0 ? parts.join(' · ') : '—'}`;
};

const orderedBulksheetColumns = (rows: PlanPreview['bulksheet_rows']) => {
  const preferred = [
    'Product',
    'Entity',
    'Operation',
    'Campaign ID',
    'Campaign Name',
    'Ad Group ID',
    'Ad Group Name',
    'Keyword ID',
    'Product Targeting ID',
    'Keyword Text',
    'Product Targeting Expression',
    'Match Type',
    'Placement',
    'Daily Budget',
    'Budget',
    'Ad Group Default Bid',
    'Bid',
    'State',
    'Bidding Strategy',
    'Percentage',
  ];
  const all = new Set<string>();
  for (const row of rows) {
    Object.keys(row.cells).forEach((key) => all.add(key));
  }
  const rest = [...all].filter((col) => !preferred.includes(col)).sort((a, b) => a.localeCompare(b));
  return [...preferred.filter((col) => all.has(col)), ...rest];
};

const normalizeKeyword = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const looksLikeHeader = (row: string[]): boolean => {
  const c0 = (row[0] ?? '').trim().toLowerCase();
  const c1 = (row[1] ?? '').trim().toLowerCase();
  if (c0 === 'keyword') return true;
  if (c1 === 'group') return true;
  for (let j = 3; j <= 14; j += 1) {
    if ((row[j] ?? '').trim().length > 0) return true;
  }
  return false;
};

type ProductDetailPageProps = {
  params: Promise<{ asin: string }> | { asin: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type KeywordImportState = {
  ok?: boolean;
  error?: string | null;
  groupCount?: number;
  keywordCount?: number;
  membershipCount?: number;
};

type KeywordSetActionState = {
  ok?: boolean;
  error?: string | null;
  action?: 'activate' | 'deactivate';
  groupSetId?: string;
};

type LogbookAiPackImportState = {
  ok?: boolean;
  error?: string | null;
  details?: Record<string, unknown> | null;
  created_experiment_id?: string;
  created_change_ids_count?: number;
};

type ProductDriverIntentRow = {
  id: string;
  channel: 'sp' | 'sb' | 'sd';
  campaign_id: string;
  intent: string;
  notes: string | null;
  is_driver: boolean;
  updated_at: string;
};

type ProductKivRow = {
  kiv_id: string;
  status: 'open' | 'done' | 'dismissed';
  title: string;
  details: string | null;
  resolution_notes: string | null;
  due_date: string | null;
  priority: number | null;
  created_at: string;
  resolved_at: string | null;
  tags: string[] | null;
};

const OVERVIEW_DRIVER_INTENT_LIMIT = 10000;
const OVERVIEW_KIV_LIMIT = 10000;

const buildTabHref = (asin: string, tab: string, start: string, end: string) =>
  `/products/${asin}?start=${start}&end=${end}&tab=${tab}`;

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const asin = resolvedParams.asin.trim().toUpperCase();
  const paramsMap = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = paramsMap?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const defaults = getDefaultMarketplaceDateRange({
    marketplace: env.marketplace,
    daysBack: 30,
    delayDays: 2,
  });
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const tab = paramValue('tab') ?? 'overview';
  const aiBaselineRange = paramValue('range');
  const logbookNotice = paramValue('logbook_notice');
  const logbookError = paramValue('logbook_error');
  const sqpWeekEnd = normalizeDate(paramValue('sqp_week_end'));
  const sqpTrendEnabled = paramValue('sqp_trend') === '1';
  const sqpTrendQuery = paramValue('sqp_trend_query');
  const sqpTrendMetricsRaw =
    paramValue('sqp_trend_kpis') ?? paramValue('sqp_trend_metrics');
  const sqpTrendMetrics =
    sqpTrendMetricsRaw
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const sqpTrendFromRaw = normalizeDate(paramValue('sqp_trend_from'));
  const sqpTrendToRaw = normalizeDate(paramValue('sqp_trend_to'));
  const changesChannel = normalizeChangesChannelFilter(paramValue('ch_channel'));
  const changesSource = normalizeChangesSourceFilter(paramValue('ch_source'));
  const changesValidation = normalizeChangesValidationFilter(paramValue('ch_validation'));
  const changesQuery = (paramValue('ch_q') ?? '').trim();

  const importKeywordGroups = async (
    _prevState: KeywordImportState,
    formData: FormData
  ): Promise<KeywordImportState> => {
    'use server';

    const groupSetNameRaw = formData.get('group_set_name');
    const groupSetName =
      typeof groupSetNameRaw === 'string' ? groupSetNameRaw.trim() : '';
    const isExclusive = formData.get('is_exclusive') === 'on';
    const setActive = formData.get('set_active') === 'on';
    const file = formData.get('file');

    if (!groupSetName) {
      return { ok: false, error: 'Group set name is required.' };
    }

    if (!file || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'CSV file is required.' };
    }

    try {
      const { productId } = await ensureProductId({
        accountId: env.accountId,
        marketplace: env.marketplace,
        asin,
      });

      const csvContent = await file.text();
      const rows = parseCsv(csvContent);

      if (rows.length < 1) {
        return { ok: false, error: 'CSV must contain at least one header row.' };
      }

      if (rows[0]?.[0]?.startsWith('\ufeff')) {
        rows[0][0] = rows[0][0].replace(/^\ufeff/, '');
      }

      let headerIndex = 0;
      if (rows.length >= 2 && !looksLikeHeader(rows[0]) && looksLikeHeader(rows[1])) {
        headerIndex = 1;
      }

      const headerRow = rows[headerIndex];
      const groupHeaders: string[] = [];
      for (let j = 3; j <= 14; j += 1) {
        const headerValue = headerRow[j];
        if (!headerValue) continue;
        const trimmed = headerValue.trim();
        if (!trimmed) continue;
        groupHeaders.push(trimmed);
      }

      const uniqueGroupNames: string[] = [];
      const seenGroupNames = new Set<string>();
      for (const name of groupHeaders) {
        if (seenGroupNames.has(name)) continue;
        seenGroupNames.add(name);
        uniqueGroupNames.push(name);
      }

      if (uniqueGroupNames.length === 0) {
        return {
          ok: false,
          error: 'At least one group name is required in columns D..O.',
        };
      }

      const { data: groupSet, error: groupSetError } = await supabaseAdmin
        .from('keyword_group_sets')
        .insert({
          product_id: productId,
          name: groupSetName,
          is_exclusive: isExclusive,
          is_active: setActive,
        })
        .select('group_set_id')
        .single();

      if (groupSetError || !groupSet?.group_set_id) {
        return {
          ok: false,
          error: groupSetError?.message ?? 'Failed to create group set.',
        };
      }

      const groupSetId = groupSet.group_set_id as string;

      if (setActive) {
        const { error: deactivateError } = await supabaseAdmin
          .from('keyword_group_sets')
          .update({ is_active: false })
          .eq('product_id', productId)
          .neq('group_set_id', groupSetId);

        if (deactivateError) {
          return {
            ok: false,
            error: deactivateError.message,
          };
        }
      }

      const { data: groupRows, error: groupError } = await supabaseAdmin
        .from('keyword_groups')
        .insert(
          uniqueGroupNames.map((name) => ({
            group_set_id: groupSetId,
            name,
          }))
        )
        .select('group_id,name');

      if (groupError || !groupRows) {
        return { ok: false, error: groupError?.message ?? 'Failed to create groups.' };
      }

      const groupIdByName = new Map<string, string>();
      groupRows.forEach((row) => {
        if (!row.name || !row.group_id) return;
        groupIdByName.set(row.name, row.group_id);
      });

      const memberships = new Map<
        string,
        { keywordNorm: string; keywordRaw: string; groupName: string }
      >();
      const keywordLatestRaw = new Map<string, string>();

      const addMembership = (keywordRaw: string, groupName: string) => {
        const keywordNorm = normalizeKeyword(keywordRaw);
        if (!keywordNorm) return;
        keywordLatestRaw.set(keywordNorm, keywordRaw);
        const key = `${groupName}||${keywordNorm}`;
        if (!memberships.has(key)) {
          memberships.set(key, { keywordNorm, keywordRaw, groupName });
        }
      };

      const dataStart = headerIndex + 1;
      for (let i = dataStart; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row) continue;

        const col0 = row[0] ?? '';
        const col1 = row[1] ?? '';

        if (col0.trim().length > 0 && col1.trim().length > 0) {
          addMembership(col0, col1.trim());
        }

        for (let j = 3; j <= 14; j += 1) {
          const cell = row[j] ?? '';
          if (cell.trim().length === 0) continue;
          const headerValue = headerRow[j];
          if (!headerValue || headerValue.trim().length === 0) continue;
          addMembership(cell, headerValue.trim());
        }
      }

      const keywordRows = Array.from(keywordLatestRaw.entries()).map(
        ([keywordNorm, keywordRaw]) => ({
          marketplace: env.marketplace,
          keyword_norm: keywordNorm,
          keyword_raw: keywordRaw,
        })
      );

      const keywordIdByNorm = new Map<string, string>();
      const keywordChunkSize = 500;
      for (let i = 0; i < keywordRows.length; i += keywordChunkSize) {
        const chunk = keywordRows.slice(i, i + keywordChunkSize);
        if (chunk.length === 0) continue;
        const { data: keywordData, error: keywordError } = await supabaseAdmin
          .from('dim_keyword')
          .upsert(chunk, { onConflict: 'marketplace,keyword_norm' })
          .select('keyword_id,keyword_norm');

        if (keywordError) {
          return { ok: false, error: keywordError.message };
        }

        (keywordData ?? []).forEach((row) => {
          if (!row.keyword_norm || !row.keyword_id) return;
          keywordIdByNorm.set(row.keyword_norm, row.keyword_id);
        });
      }

      const membershipRows = Array.from(memberships.values())
        .map((member) => {
          const groupId = groupIdByName.get(member.groupName);
          const keywordId = keywordIdByNorm.get(member.keywordNorm);
          if (!groupId || !keywordId) return null;
          return {
            group_id: groupId,
            group_set_id: groupSetId,
            keyword_id: keywordId,
          };
        })
        .filter(Boolean) as Array<{
        group_id: string;
        group_set_id: string;
        keyword_id: string;
      }>;

      const membershipChunkSize = 500;
      for (let i = 0; i < membershipRows.length; i += membershipChunkSize) {
        const chunk = membershipRows.slice(i, i + membershipChunkSize);
        if (chunk.length === 0) continue;
        const { error: membershipError } = await supabaseAdmin
          .from('keyword_group_members')
          .upsert(chunk, {
            onConflict: 'group_id,keyword_id',
            ignoreDuplicates: true,
          });

        if (membershipError) {
          if (membershipError.message.includes('Exclusive group set')) {
            return {
              ok: false,
              error:
                'Exclusive group set violation: a keyword was assigned to multiple groups.',
            };
          }
          return { ok: false, error: membershipError.message };
        }
      }

      revalidatePath(`/products/${asin}`);

      return {
        ok: true,
        groupCount: uniqueGroupNames.length,
        keywordCount: keywordRows.length,
        membershipCount: membershipRows.length,
      };
    } catch (error) {
      console.error('keyword_import:error', { asin, error });
      return { ok: false, error: 'Failed to import keyword groups.' };
    }
  };

  const setKeywordGroupSetActive = async (
    _prevState: KeywordSetActionState,
    formData: FormData
  ): Promise<KeywordSetActionState> => {
    'use server';

    const groupSetIdRaw = formData.get('group_set_id');
    const groupSetId = typeof groupSetIdRaw === 'string' ? groupSetIdRaw.trim() : '';
    if (!groupSetId) {
      return { ok: false, error: 'Missing group set id.' };
    }

    const { data: productRow, error: productError } = await supabaseAdmin
      .from('products')
      .select('product_id')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('asin', asin)
      .maybeSingle();

    if (productError || !productRow?.product_id) {
      return { ok: false, error: 'Product not found.' };
    }

    const productId = productRow.product_id as string;

    const { data: existingSet, error: existingError } = await supabaseAdmin
      .from('keyword_group_sets')
      .select('group_set_id')
      .eq('product_id', productId)
      .eq('group_set_id', groupSetId)
      .maybeSingle();

    if (existingError) {
      return { ok: false, error: existingError.message };
    }

    if (!existingSet?.group_set_id) {
      return { ok: false, error: 'Group set not found for this product.' };
    }

    const { error: deactivateError } = await supabaseAdmin
      .from('keyword_group_sets')
      .update({ is_active: false })
      .eq('product_id', productId);

    if (deactivateError) {
      return { ok: false, error: deactivateError.message };
    }

    const { error: activateError } = await supabaseAdmin
      .from('keyword_group_sets')
      .update({ is_active: true })
      .eq('product_id', productId)
      .eq('group_set_id', groupSetId);

    if (activateError) {
      return { ok: false, error: activateError.message };
    }

    revalidatePath(`/products/${asin}`);

    return { ok: true, action: 'activate', groupSetId };
  };

  const deactivateKeywordGroupSet = async (
    _prevState: KeywordSetActionState,
    formData: FormData
  ): Promise<KeywordSetActionState> => {
    'use server';

    const groupSetIdRaw = formData.get('group_set_id');
    const groupSetId = typeof groupSetIdRaw === 'string' ? groupSetIdRaw.trim() : '';
    if (!groupSetId) {
      return { ok: false, error: 'Missing group set id.' };
    }

    const { data: productRow, error: productError } = await supabaseAdmin
      .from('products')
      .select('product_id')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('asin', asin)
      .maybeSingle();

    if (productError || !productRow?.product_id) {
      return { ok: false, error: 'Product not found.' };
    }

    const productId = productRow.product_id as string;

    const { data: existingSet, error: existingError } = await supabaseAdmin
      .from('keyword_group_sets')
      .select('group_set_id')
      .eq('product_id', productId)
      .eq('group_set_id', groupSetId)
      .maybeSingle();

    if (existingError) {
      return { ok: false, error: existingError.message };
    }

    if (!existingSet?.group_set_id) {
      return { ok: false, error: 'Group set not found for this product.' };
    }

    const { error: deactivateError } = await supabaseAdmin
      .from('keyword_group_sets')
      .update({ is_active: false })
      .eq('product_id', productId)
      .eq('group_set_id', groupSetId);

    if (deactivateError) {
      return { ok: false, error: deactivateError.message };
    }

    revalidatePath(`/products/${asin}`);

    return { ok: true, action: 'deactivate', groupSetId };
  };

  const importLogbookAiPackAction = async (
    _prevState: LogbookAiPackImportState,
    formData: FormData
  ): Promise<LogbookAiPackImportState> => {
    'use server';

    const file = formData.get('file');
    if (!file || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'JSON file is required.' };
    }

    const fileText = await file.text();
    const result = await importProductExperimentOutputPack({
      fileText,
      currentAsin: asin,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? 'Failed to import AI pack.',
        details: result.details ?? null,
      };
    }

    revalidatePath(`/products/${asin}`);

    return {
      ok: true,
      created_experiment_id: result.created_experiment_id,
      created_change_ids_count: result.created_change_ids_count,
    };
  };

  const generateBulkgenPlanAction = async (formData: FormData) => {
    'use server';

    const experimentId = String(formData.get('experiment_id') ?? '').trim();
    const channel = String(formData.get('channel') ?? '').trim().toUpperCase();
    const runId = String(formData.get('run_id') ?? '').trim();

    if (!experimentId || (channel !== 'SP' && channel !== 'SB') || !runId) {
      redirect(
        `/products/${asin}?start=${start}&end=${end}&tab=logbook&logbook_error=${encodeURIComponent(
          'Missing experiment plan identifiers.'
        )}`
      );
    }

    try {
      const { data: experimentRow, error: experimentError } = await supabaseAdmin
        .from('log_experiments')
        .select('experiment_id,scope')
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .eq('experiment_id', experimentId)
        .maybeSingle();

      if (experimentError || !experimentRow?.experiment_id) {
        throw new Error('Experiment not found.');
      }

      const selection = selectBulkgenPlansForExecution(experimentRow.scope);
      const plans = selection.plans;
      const matchedPlan = plans.find((plan) => plan.channel === channel && plan.run_id === runId);
      if (!matchedPlan) {
        throw new Error('Plan not found in experiment scope.');
      }
      const planRefNote =
        selection.source === 'final_plan' && selection.final_plan_pack_id
          ? `final_plan_pack_id=${selection.final_plan_pack_id}`
          : null;
      const generatorNotes = [matchedPlan.notes ?? null, planRefNote]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(' | ');

      if (!env.bulkgenOutRoot) {
        throw new Error('BULKGEN_OUT_ROOT is required.');
      }

      if (matchedPlan.channel === 'SP') {
        const templatePath = await downloadTemplateToLocalPath('sp_update');

        await runSpUpdateGenerator({
          templatePath,
          outRoot: env.bulkgenOutRoot,
          notes: generatorNotes || null,
          runId: matchedPlan.run_id,
          productId: asin,
          experimentId: experimentId,
          finalPlanPackId: selection.final_plan_pack_id ?? null,
          logEnabled: true,
          actions: matchedPlan.actions as Record<string, unknown>[],
        });
      } else {
        const templatePath = await downloadTemplateToLocalPath('sb_update');

        await runSbUpdateGenerator({
          templatePath,
          outRoot: env.bulkgenOutRoot,
          notes: generatorNotes || null,
          runId: matchedPlan.run_id,
          productId: asin,
          experimentId: experimentId,
          finalPlanPackId: selection.final_plan_pack_id ?? null,
          logEnabled: true,
          actions: matchedPlan.actions as Record<string, unknown>[],
        });
      }

      revalidatePath(`/products/${asin}`);

      redirect(
        `/products/${asin}?start=${start}&end=${end}&tab=logbook&logbook_notice=${encodeURIComponent(
          selection.source === 'proposal'
            ? `Generated ${channel} bulksheet for run_id=${runId}. Warning: plan is not finalized; using proposal fallback.`
            : `Generated ${channel} bulksheet for run_id=${runId}.`
        )}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to generate bulksheet.';
      redirect(
        `/products/${asin}?start=${start}&end=${end}&tab=logbook&logbook_error=${encodeURIComponent(
          message
        )}`
      );
    }
  };

  const validateLogbookChangeNowAction = async (formData: FormData) => {
    'use server';

    const changeId = String(formData.get('change_id') ?? '').trim();
    if (!changeId) {
      redirect(
        `/products/${asin}?start=${start}&end=${end}&tab=logbook&logbook_error=${encodeURIComponent(
          'Missing change id.'
        )}`
      );
    }

    try {
      await runManualBulkgenValidation(changeId);
      revalidatePath(`/products/${asin}`);
      redirect(
        `/products/${asin}?start=${start}&end=${end}&tab=logbook&logbook_notice=${encodeURIComponent(
          'Validation completed.'
        )}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Validation failed.';
      redirect(
        `/products/${asin}?start=${start}&end=${end}&tab=logbook&logbook_error=${encodeURIComponent(
          message
        )}`
      );
    }
  };

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const changesExplorerFilters: ProductChangesExplorerFilters = {
    channel: changesChannel,
    source: changesSource,
    validation: changesValidation,
    q: changesQuery,
  };

  const [
    data,
    logbookData,
    changesExplorerRows,
    keywordGroups,
    keywordTemplates,
    promptTemplates,
    rankingRows,
    sqpWeekly,
    sqpTrendResult,
  ] = await Promise.all([
    getProductDetailData({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin,
      start,
      end,
    }),
    tab === 'logbook'
      ? getProductLogbookData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
        })
      : Promise.resolve({
          experiments: [],
          unassigned_changes: [],
        }),
    tab === 'changes'
      ? getProductChangesExplorerData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
          filters: changesExplorerFilters,
        })
      : Promise.resolve([]),
    tab === 'keywords' || tab === 'ranking' || tab === 'sqp'
      ? getProductKeywordGroups({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
        })
      : Promise.resolve(null),
    tab === 'keywords'
      ? getKeywordAiPackTemplates({
          accountId: env.accountId,
          marketplace: env.marketplace,
        })
      : Promise.resolve([]),
    tab === 'logbook'
      ? getProductExperimentPromptTemplates({
          accountId: env.accountId,
          marketplace: env.marketplace,
        })
      : Promise.resolve([]),
    tab === 'ranking'
      ? getProductRankingDaily({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
        })
      : Promise.resolve([]),
    tab === 'sqp'
      ? getProductSqpWeekly({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
          weekEnd: sqpWeekEnd,
        })
      : Promise.resolve(null),
    tab === 'sqp' && sqpTrendEnabled && sqpTrendQuery
      ? getProductSqpTrendSeries({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          searchQueryNorm: sqpTrendQuery,
          fromWeekEnd: sqpTrendFromRaw,
          toWeekEnd: sqpTrendToRaw,
        })
      : Promise.resolve(null),
  ]);

  const planPreviewsByExperimentId = new Map<string, PlanPreview[]>();
  if (tab === 'logbook') {
    await Promise.all(
      logbookData.experiments.map(async (group) => {
        const previews = await buildPlanPreviewsForScope(group.experiment.scope);
        planPreviewsByExperimentId.set(group.experiment.experiment_id, previews);
      })
    );
  }

  const keywordAiPackTemplateOptions =
    tab === 'keywords' ? toKeywordTemplateOptions(keywordTemplates) : [];

  const productExperimentPromptTemplateOptions =
    tab === 'logbook' ? toProductExperimentPromptTemplateOptions(promptTemplates) : [];

  const keywordGroupMemberships =
    (tab === 'ranking' || tab === 'sqp') && keywordGroups?.group_sets?.length
      ? await getProductKeywordGroupMemberships({
          groupSetIds: keywordGroups.group_sets.map((set) => set.group_set_id),
        })
      : null;

  const sqpTrendSeries = sqpTrendResult?.series ?? null;
  const sqpTrendFrom = sqpTrendResult?.selectedFrom ?? null;
  const sqpTrendTo = sqpTrendResult?.selectedTo ?? null;
  const sqpTrendAvailableWeeks = sqpTrendResult?.availableWeeks ?? [];

  const sqpTrendLabel =
    sqpTrendSeries?.[0]?.search_query_raw ??
    sqpTrendSeries?.[0]?.search_query_norm ??
    sqpTrendQuery ??
    null;

  const shortName = data.productMeta.short_name?.trim();
  const title = data.productMeta.title?.trim();
  const displayName = shortName || title || asin;
  const showTitle = Boolean(shortName && title && title !== shortName);
  const profileJson = asObject(data.productMeta.profile_json);
  const profileSkills = scopeStringArray(profileJson, 'skills');
  const profileIntent = asObject(profileJson?.intent);
  const resolvedSkillLibrary = tab === 'overview' ? listResolvedSkills() : [];
  const resolvedSkillLibraryEntries = resolvedSkillLibrary.map((skill) => ({
    id: skill.id,
    title: skill.title,
    tags: skill.tags,
    applies_to: skill.applies_to,
    content_md: skill.content_md,
  }));
  const availableSkillOptions = resolvedSkillLibrary.map((skill) => ({
    id: skill.id,
    title: skill.title,
  }));
  const resolvedProfileSkills =
    tab === 'overview'
      ? resolveSkillsByIds(profileSkills).map((skill) => ({
          id: skill.id,
          title: skill.title,
          tags: skill.tags,
          applies_to: skill.applies_to,
          content_md: skill.content_md,
        }))
      : [];

  let productDriverIntents: ProductDriverIntentRow[] = [];
  let productKivOpenItems: ProductKivRow[] = [];
  let productKivRecentlyClosedItems: ProductKivRow[] = [];
  const overviewWarnings: string[] = [];

  if (tab === 'overview') {
    const [driverIntentResult, kivResult] = await Promise.all([
      supabaseAdmin
        .from('log_driver_campaign_intents')
        .select('id,channel,campaign_id,intent,notes,is_driver,updated_at')
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .eq('asin_norm', asin)
        .order('updated_at', { ascending: false })
        .limit(OVERVIEW_DRIVER_INTENT_LIMIT),
      supabaseAdmin
        .from('log_product_kiv_items')
        .select(
          'kiv_id,status,title,details,resolution_notes,due_date,priority,created_at,resolved_at,tags'
        )
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .eq('asin_norm', asin)
        .order('created_at', { ascending: false })
        .limit(OVERVIEW_KIV_LIMIT),
    ]);

    if (driverIntentResult.error) {
      console.error('product_driver_intents:load_error', {
        asin,
        error: driverIntentResult.error.message,
      });
      overviewWarnings.push(
        `Driver intents panel is unavailable: ${driverIntentResult.error.message}`
      );
    } else {
      productDriverIntents = (driverIntentResult.data ?? []).map((row) => ({
        id: String(row.id ?? ''),
        channel: normalizeDriverChannel(row.channel),
        campaign_id: String(row.campaign_id ?? ''),
        intent: String(row.intent ?? ''),
        notes: typeof row.notes === 'string' ? row.notes : null,
        is_driver: row.is_driver === true,
        updated_at: String(row.updated_at ?? ''),
      }));

      if (productDriverIntents.length >= OVERVIEW_DRIVER_INTENT_LIMIT) {
        overviewWarnings.push(
          `Driver intents reached hard cap (${OVERVIEW_DRIVER_INTENT_LIMIT.toLocaleString('en-US')}). Results may be truncated.`
        );
      }
    }

    if (kivResult.error) {
      console.error('product_kiv:load_error', {
        asin,
        error: kivResult.error.message,
      });
      overviewWarnings.push(`KIV backlog panel is unavailable: ${kivResult.error.message}`);
    } else {
      const normalizedKivRows: ProductKivRow[] = (kivResult.data ?? []).map((row) => ({
        kiv_id: String(row.kiv_id ?? ''),
        status: normalizeKivStatus(row.status),
        title: String(row.title ?? ''),
        details: typeof row.details === 'string' ? row.details : null,
        resolution_notes:
          typeof row.resolution_notes === 'string' ? row.resolution_notes : null,
        due_date: typeof row.due_date === 'string' ? row.due_date : null,
        priority: (() => {
          const raw =
            typeof row.priority === 'number'
              ? row.priority
              : typeof row.priority === 'string'
                ? Number(row.priority)
                : null;
          return raw !== null && Number.isFinite(raw) ? raw : null;
        })(),
        created_at: String(row.created_at ?? ''),
        resolved_at: typeof row.resolved_at === 'string' ? row.resolved_at : null,
        tags: Array.isArray(row.tags)
          ? row.tags
              .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
              .filter(Boolean)
          : null,
      }));

      const groupedKiv = deriveKivCarryForward(normalizedKivRows);
      productKivOpenItems = groupedKiv.open as ProductKivRow[];
      productKivRecentlyClosedItems = groupedKiv.recently_closed as ProductKivRow[];

      if (normalizedKivRows.length >= OVERVIEW_KIV_LIMIT) {
        overviewWarnings.push(
          `KIV backlog reached hard cap (${OVERVIEW_KIV_LIMIT.toLocaleString('en-US')}). Results may be truncated.`
        );
      }
    }
  }

  const kpiItems = [
    {
      label: 'Sales',
      value: formatCurrency(data.kpis.total_sales),
    },
    {
      label: 'Orders',
      value: formatNumber(data.kpis.total_orders),
      subvalue: `Units ${formatNumber(data.kpis.total_units)}`,
    },
    {
      label: 'PPC cost',
      value: formatCurrency(data.kpis.total_ppc_cost),
      subvalue: `TACOS ${formatPercent(data.kpis.tacos)}`,
    },
    {
      label: 'Avg price',
      value: formatCurrency(data.kpis.avg_selling_price),
    },
  ];

  const tabs = [
    { label: 'Overview', value: 'overview' },
    { label: 'Sales', value: 'sales' },
    { label: 'Logbook', value: 'logbook' },
    { label: 'Changes', value: 'changes' },
    { label: 'Costs', value: 'costs' },
    { label: 'Ads', value: 'ads' },
    { label: 'Keywords', value: 'keywords' },
    { label: 'SQP', value: 'sqp' },
    { label: 'Ranking', value: 'ranking' },
  ].map((item) => ({
    ...item,
    href: buildTabHref(asin, item.value, start, end),
  }));

  const trendSeries = data.salesSeries.map((row) => ({
    date: row.date ?? '',
    sales: Number(row.sales ?? 0),
    ppc_cost: Number(row.ppc_cost ?? 0),
    orders: Number(row.orders ?? 0),
    units: Number(row.units ?? 0),
  }));
  const logbookExperiments = logbookData.experiments;
  const logbookUnassigned = logbookData.unassigned_changes;
  const hasLogbookEntries = logbookExperiments.length > 0 || logbookUnassigned.length > 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Product detail
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {displayName}
            </div>
            <div className="mt-1 text-sm text-muted">
              ASIN {asin} · {start} → {end}
            </div>
            {showTitle ? (
              <div className="mt-2 text-sm text-muted">{title}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-4 text-sm text-muted">
            {tab !== 'sqp' ? (
              <form method="get" className="flex flex-wrap items-end gap-3">
                {tab ? <input type="hidden" name="tab" value={tab} /> : null}
                <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                  Start
                  <input
                    type="date"
                    name="start"
                    defaultValue={start}
                    className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                  End
                  <input
                    type="date"
                    name="end"
                    defaultValue={end}
                    className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Apply
                </button>
              </form>
            ) : null}
            <Link href={`/imports-health`} className="font-semibold text-foreground">
              View Imports &amp; Health
            </Link>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted">
          Data is delayed 48h while ads finalize.
        </div>
      </section>

      <Tabs items={tabs} current={tab} />

      {tab === 'overview' ? (
        <div className="space-y-4">
          {overviewWarnings.length > 0 ? (
            <section className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
              <div className="font-semibold">Overview warning</div>
              <ul className="mt-2 list-disc pl-5 text-muted">
                {overviewWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <KpiCards items={kpiItems} />
              <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-muted">
                    Sales vs PPC cost
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    Daily trend
                  </div>
                </div>
                {trendSeries.length > 0 ? (
                  <TrendChart data={trendSeries} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                    No sales trend data for this range.
                  </div>
                )}
              </section>
            </div>
            <div className="space-y-6">
              <ProductProfileSkillsIntentEditor
                asin={asin}
                displayName={displayName}
                initialShortName={shortName ?? ''}
                initialNotes={data.productMeta.notes ?? ''}
                initialSkills={profileSkills}
                initialIntent={profileIntent}
                availableSkills={availableSkillOptions}
                resolvedSkillLibrary={resolvedSkillLibraryEntries}
                resolvedSelectedSkills={resolvedProfileSkills}
              />
              <ProductDriverIntentManager asin={asin} initialRows={productDriverIntents} />
              <ProductKivBacklogManager
                asin={asin}
                initialOpenItems={productKivOpenItems}
                initialRecentlyClosedItems={productKivRecentlyClosedItems}
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'sales' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-foreground">Daily sales</div>
          {data.salesSeries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
              No sales data for this range.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted shadow-sm">
                    <tr>
                      <th className="w-28 pb-2">Date</th>
                      <th className="w-28 pb-2">Sales</th>
                      <th className="w-24 pb-2">Orders</th>
                      <th className="w-24 pb-2">Units</th>
                      <th className="w-28 pb-2">PPC Cost</th>
                      <th className="w-28 pb-2">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.salesSeries.map((row, index) => (
                      <tr
                        key={row.date ?? `row-${index}`}
                        className="hover:bg-surface-2/70"
                      >
                        <td className="py-3 text-muted">{row.date ?? '—'}</td>
                        <td className="py-3 text-muted">
                          {formatCurrency(Number(row.sales ?? 0))}
                        </td>
                        <td className="py-3 text-muted">
                          {formatNumber(Number(row.orders ?? 0))}
                        </td>
                        <td className="py-3 text-muted">
                          {formatNumber(Number(row.units ?? 0))}
                        </td>
                        <td className="py-3 text-muted">
                          {formatCurrency(Number(row.ppc_cost ?? 0))}
                        </td>
                        <td className="py-3 text-muted">
                          {formatCurrency(Number(row.avg_sales_price ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'logbook' ? (
        <section className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted">
                  Product logbook
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  AI workflow + experiments linked to {asin}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/logbook/changes/new?product_id=${encodeURIComponent(asin)}`}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
                >
                  Create change
                </Link>
                <Link
                  href={`/logbook/experiments/new?product_id=${encodeURIComponent(asin)}`}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Create experiment
                </Link>
              </div>
            </div>

            {logbookError ? (
              <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {logbookError}
              </div>
            ) : null}
            {logbookNotice ? (
              <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {logbookNotice}
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 text-sm font-semibold text-foreground">AI workflow</div>
              <div className="mb-3 text-sm text-muted">
                Download the prompt + data packs for this ASIN, run your AI workflow, then upload
                the AI Output Pack JSON to create the experiment and optional manual changes.
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <ProductExperimentPromptPackDownload
                  asin={asin}
                  templates={productExperimentPromptTemplateOptions}
                />
                <ProductBaselineDataPackDownload asin={asin} initialRange={aiBaselineRange} />
              </div>
              <ProductLogbookAiPackImport action={importLogbookAiPackAction} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-foreground">Experiments</div>
            {logbookExperiments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted">
                No experiments for this product yet.
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  data-aph-hscroll
                  data-aph-hscroll-axis="x"
                  className="overflow-x-auto rounded-lg border border-border"
                >
                  <table className="w-full min-w-[920px] table-fixed text-left text-sm">
                    <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted">
                      <tr>
                        <th className="w-[34%] px-3 py-2">Title</th>
                        <th className="w-[18%] px-3 py-2">Window</th>
                        <th className="w-[14%] px-3 py-2">Status</th>
                        <th className="w-[14%] px-3 py-2">Outcome</th>
                        <th className="w-[20%] px-3 py-2">Last Evaluated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logbookExperiments.map((group) => (
                        <tr key={`summary-${group.experiment.experiment_id}`} className="hover:bg-surface-2/70">
                          <td className="px-3 py-2">
                            <Link
                              href={`/logbook/experiments/${group.experiment.experiment_id}`}
                              className="font-semibold text-foreground hover:underline"
                            >
                              {group.experiment.name}
                            </Link>
                            <div className="text-xs text-muted">{group.experiment.objective}</div>
                          </td>
                          <td className="px-3 py-2 text-muted">
                            {formatDateOnly(group.start_date)} → {formatDateOnly(group.end_date)}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium uppercase text-primary">
                              {group.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-xs font-semibold ${getOutcomePillClassName(
                                group.outcome_score
                              )}`}
                            >
                              {formatOutcomePercent(group.outcome_score)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted">
                            {formatDateTime(group.latest_evaluation?.evaluated_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {logbookExperiments.map((group) => {
                  const scope = asObject(group.experiment.scope);
                  const fiveWOneH =
                    asObject(scope?.five_w_one_h) ?? asObject(scope?.['5w1h']);
                  const plan = scopeStringArray(scope, 'plan');
                  const actions = scopeStringArray(scope, 'actions');
                  const tags = scopeStringArray(scope, 'tags');
                  const expectedOutcome = scopeString(scope, 'expected_outcome');
                  const outcomeSummary =
                    extractEvaluationSummary(group.latest_evaluation?.metrics_json ?? null) ??
                    scopeString(scope, 'outcome_summary');
                  const rawScope = formatUnknownJson(group.experiment.scope);
                  const rawEvaluation = formatUnknownJson(
                    group.latest_evaluation?.metrics_json ?? null
                  );
                  const latestOutcome = extractEvaluationOutcome(
                    group.latest_evaluation?.metrics_json ?? null
                  );
                  const planPreviews =
                    planPreviewsByExperimentId.get(group.experiment.experiment_id) ?? [];

                  const validationSummary = group.changes.reduce(
                    (acc, item) => {
                      const status =
                        item.change.source === 'bulkgen'
                          ? item.validation?.status ?? 'pending'
                          : 'pending';
                      if (status === 'validated') acc.validated += 1;
                      else if (status === 'mismatch') acc.mismatch += 1;
                      else if (status === 'not_found') acc.notFound += 1;
                      else acc.pending += 1;
                      return acc;
                    },
                    { validated: 0, mismatch: 0, pending: 0, notFound: 0 }
                  );

                  return (
                    <details
                      id={`experiment-${group.experiment.experiment_id}`}
                      key={group.experiment.experiment_id}
                      className="rounded-xl border border-border bg-surface p-4"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-foreground">
                              {group.experiment.name}
                            </div>
                            <div className="mt-1 text-sm text-muted">
                              {group.experiment.objective}
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              {formatDateOnly(group.start_date)} → {formatDateOnly(group.end_date)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-primary/10 px-2 py-1 font-medium uppercase text-primary">
                              {group.status}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 font-semibold ${getOutcomePillClassName(
                                latestOutcome?.score ?? group.outcome_score
                              )}`}
                            >
                              Outcome {formatOutcomePercent(latestOutcome?.score ?? group.outcome_score)}
                            </span>
                            <span className="text-muted">
                              Last evaluated {formatDateTime(group.latest_evaluation?.evaluated_at)}
                            </span>
                          </div>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-4 border-t border-border pt-4">
                        {group.experiment.hypothesis ? (
                          <div className="text-sm text-muted">
                            <span className="font-semibold text-foreground">Hypothesis:</span>{' '}
                            {group.experiment.hypothesis}
                          </div>
                        ) : null}

                        {tags.length > 0 ? (
                          <div className="text-sm text-muted">
                            <span className="font-semibold text-foreground">Tags:</span>{' '}
                            {tags.join(', ')}
                          </div>
                        ) : null}

                        {fiveWOneH ? (
                          <div className="rounded-lg border border-border bg-surface-2 p-3">
                            <div className="mb-2 text-xs uppercase tracking-wide text-muted">
                              5W1H
                            </div>
                            <div className="grid gap-2 text-sm text-muted md:grid-cols-2">
                              <div>
                                <span className="font-semibold text-foreground">Who:</span>{' '}
                                {scopeString(fiveWOneH, 'who') ?? '—'}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">What:</span>{' '}
                                {scopeString(fiveWOneH, 'what') ?? '—'}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">When:</span>{' '}
                                {scopeString(fiveWOneH, 'when') ?? '—'}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">Where:</span>{' '}
                                {scopeString(fiveWOneH, 'where') ?? '—'}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">Why:</span>{' '}
                                {scopeString(fiveWOneH, 'why') ?? '—'}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">How:</span>{' '}
                                {scopeString(fiveWOneH, 'how') ?? '—'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                            5W1H is missing from experiment scope.
                          </div>
                        )}

                        {expectedOutcome ? (
                          <div className="text-sm text-muted">
                            <span className="font-semibold text-foreground">
                              Expected outcome:
                            </span>{' '}
                            {expectedOutcome}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                            Expected outcome is missing from experiment scope.
                          </div>
                        )}

                        {plan.length > 0 ? (
                          <div>
                            <div className="text-sm font-semibold text-foreground">Plan</div>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                              {plan.map((step, index) => (
                                <li key={`${group.experiment.experiment_id}-plan-${index}`}>
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {actions.length > 0 ? (
                          <div>
                            <div className="text-sm font-semibold text-foreground">Actions</div>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                              {actions.map((action, index) => (
                                <li key={`${group.experiment.experiment_id}-action-${index}`}>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
                          <div className="font-semibold text-foreground">Validation summary</div>
                          <div className="mt-1">
                            validated {validationSummary.validated} · mismatch{' '}
                            {validationSummary.mismatch} · pending {validationSummary.pending} ·
                            not_found {validationSummary.notFound}
                          </div>
                        </div>

                        {planPreviews.length > 0 ? (
                          <div className="space-y-4">
                            <div className="text-sm font-semibold text-foreground">
                              Ads plan previews
                            </div>
                            {planPreviews.map((preview, previewIndex) => {
                              const bulksheetColumns = orderedBulksheetColumns(
                                preview.bulksheet_rows
                              );
                              return (
                                <div
                                  key={`${group.experiment.experiment_id}-plan-${preview.channel}-${preview.run_id}-${previewIndex}`}
                                  className="rounded-lg border border-border bg-surface-2 p-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-foreground">
                                        {preview.channel} · run_id={preview.run_id}
                                      </div>
                                      <div className="text-xs text-muted">
                                        Snapshot {preview.snapshot_date || '—'}
                                      </div>
                                      <div className="text-xs text-muted">
                                        Source {preview.plan_source}
                                        {preview.final_plan_pack_id
                                          ? ` · final_plan_pack_id=${preview.final_plan_pack_id}`
                                          : ''}
                                      </div>
                                      {preview.notes ? (
                                        <div className="mt-1 text-xs text-muted">
                                          Notes: {preview.notes}
                                        </div>
                                      ) : null}
                                      {preview.plan_warning ? (
                                        <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                          {preview.plan_warning}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <form action={generateBulkgenPlanAction}>
                                        <input
                                          type="hidden"
                                          name="experiment_id"
                                          value={group.experiment.experiment_id}
                                        />
                                        <input type="hidden" name="channel" value={preview.channel} />
                                        <input type="hidden" name="run_id" value={preview.run_id} />
                                        <button
                                          type="submit"
                                          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                                        >
                                          Generate bulksheet
                                        </button>
                                      </form>
                                      <a
                                        href={`/api/files?path=${encodeURIComponent(`${preview.run_id}/upload_strict.xlsx`)}`}
                                        className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground hover:bg-surface-2"
                                      >
                                        Download upload
                                      </a>
                                      <a
                                        href={`/api/files?path=${encodeURIComponent(`${preview.run_id}/review.xlsx`)}`}
                                        className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground hover:bg-surface-2"
                                      >
                                        Download review
                                      </a>
                                    </div>
                                  </div>

                                  {preview.error ? (
                                    <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-2 text-xs text-amber-700">
                                      {preview.error}
                                    </div>
                                  ) : null}

                                  <div className="mt-3 space-y-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                                      Review preview
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto">
                                      <div
                                        data-aph-hscroll
                                        data-aph-hscroll-axis="x"
                                        className="overflow-x-auto"
                                      >
                                        <table className="w-full min-w-[960px] table-fixed text-left text-xs">
                                          <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-muted shadow-sm">
                                            <tr>
                                              <th className="w-36 pb-2">Action</th>
                                              <th className="w-24 pb-2">Entity</th>
                                              <th className="w-32 pb-2">Campaign</th>
                                              <th className="w-28 pb-2">Ad Group</th>
                                              <th className="w-28 pb-2">Target</th>
                                              <th className="w-36 pb-2">Placement</th>
                                              <th className="w-24 pb-2">Field</th>
                                              <th className="w-28 pb-2">Before</th>
                                              <th className="w-28 pb-2">After</th>
                                              <th className="w-24 pb-2">Delta</th>
                                              <th className="w-36 pb-2">Notes</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border">
                                            {preview.review_rows.map((row, rowIndex) => (
                                              <tr key={`${preview.run_id}-review-${rowIndex}`}>
                                                <td className="py-2 text-muted">{row.action_type}</td>
                                                <td className="py-2 text-muted">{row.entity}</td>
                                                <td className="py-2 text-muted">
                                                  {row.campaign_id ?? '—'}
                                                </td>
                                                <td className="py-2 text-muted">
                                                  {row.ad_group_id ?? '—'}
                                                </td>
                                                <td className="py-2 text-muted">
                                                  {row.target_id ?? '—'}
                                                </td>
                                                <td className="py-2 text-muted">
                                                  {row.placement ?? '—'}
                                                </td>
                                                <td className="py-2 text-muted">{row.field}</td>
                                                <td className="py-2 text-muted">
                                                  {toDisplayValue(row.before)}
                                                </td>
                                                <td className="py-2 text-muted">
                                                  {toDisplayValue(row.after)}
                                                </td>
                                                <td className="py-2 text-muted">
                                                  {toDisplayValue(row.delta)}
                                                </td>
                                                <td className="py-2 text-muted">
                                                  {row.notes ?? '—'}
                                                </td>
                                              </tr>
                                            ))}
                                            {preview.review_rows.length === 0 ? (
                                              <tr>
                                                <td
                                                  colSpan={11}
                                                  className="py-3 text-center text-muted"
                                                >
                                                  No review rows.
                                                </td>
                                              </tr>
                                            ) : null}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                                      Bulksheet preview
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto">
                                      <div
                                        data-aph-hscroll
                                        data-aph-hscroll-axis="x"
                                        className="overflow-x-auto"
                                      >
                                        <table className="w-full min-w-[960px] table-fixed text-left text-xs">
                                          <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-muted shadow-sm">
                                            <tr>
                                              <th className="w-36 pb-2">Sheet</th>
                                              {bulksheetColumns.map((column) => (
                                                <th key={column} className="w-36 pb-2">
                                                  {column}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border">
                                            {preview.bulksheet_rows.map((row, rowIndex) => (
                                              <tr key={`${preview.run_id}-sheet-${rowIndex}`}>
                                                <td className="py-2 text-muted">{row.sheet_name}</td>
                                                {bulksheetColumns.map((column) => (
                                                  <td
                                                    key={`${preview.run_id}-${rowIndex}-${column}`}
                                                    className="py-2 text-muted"
                                                  >
                                                    {toDisplayValue(row.cells[column])}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                            {preview.bulksheet_rows.length === 0 ? (
                                              <tr>
                                                <td
                                                  colSpan={1 + bulksheetColumns.length}
                                                  className="py-3 text-center text-muted"
                                                >
                                                  No bulksheet rows.
                                                </td>
                                              </tr>
                                            ) : null}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {group.latest_evaluation ? (
                          <div className="rounded-lg border border-border bg-surface-2 p-3">
                            <div className="text-xs uppercase tracking-wide text-muted">
                              Latest evaluation
                            </div>
                            <div className="mt-1 text-sm text-muted">
                              {formatDateTime(group.latest_evaluation.evaluated_at)}
                              {group.latest_evaluation.window_start ||
                              group.latest_evaluation.window_end
                                ? ` · ${group.latest_evaluation.window_start ?? '—'} → ${group.latest_evaluation.window_end ?? '—'}`
                                : ''}
                            </div>
                            <div className="mt-1 text-sm text-muted">
                              Notes: {group.latest_evaluation_notes ?? '—'}
                            </div>
                            <div className="mt-1 text-sm text-muted">
                              Outcome summary: {outcomeSummary ?? '—'}
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              Outcome label: {latestOutcome?.label ?? '—'}
                              {latestOutcome?.confidence !== null &&
                              latestOutcome?.confidence !== undefined &&
                              Number.isFinite(latestOutcome.confidence)
                                ? ` · confidence ${Math.round(
                                    (latestOutcome.confidence as number) * 100
                                  )}%`
                                : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                            No evaluation uploaded yet.
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/logbook/experiments/${group.experiment.experiment_id}/ai-deep-dive-pack`}
                            download
                            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface"
                          >
                            Download Deep Dive Pack
                          </a>
                          <a
                            href={`/logbook/experiments/${group.experiment.experiment_id}/ai-eval-prompt-pack`}
                            download
                            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface"
                          >
                            Download Eval Prompt Pack
                          </a>
                          <a
                            href={`/logbook/experiments/${group.experiment.experiment_id}/ai-eval-data-pack`}
                            download
                            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface"
                          >
                            Download Eval Data Pack
                          </a>
                          <Link
                            href={`/logbook/changes/new?experiment_id=${group.experiment.experiment_id}`}
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
                          >
                            Add change
                          </Link>
                        </div>

                        <ExperimentEvaluationOutputPackImport
                          experimentId={group.experiment.experiment_id}
                          uploadUrl={`/logbook/experiments/${group.experiment.experiment_id}/evaluation-import`}
                        />

                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-foreground">
                            Linked changes ({group.changes.length})
                          </div>
                          {group.changes.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                              No linked changes.
                            </div>
                          ) : (
                            group.changes.map((item) => {
                              const validationStatus =
                                item.change.source === 'bulkgen'
                                  ? item.validation?.status ?? 'pending'
                                  : 'n/a';
                              return (
                                <div
                                  key={item.change.change_id}
                                  className="rounded-lg border border-border bg-surface-2 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-foreground">
                                        {item.change.change_type}
                                      </span>
                                      <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted">
                                        {item.change.channel}
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted">
                                      {formatDateTime(item.change.occurred_at)}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-sm text-foreground">
                                    {item.change.summary}
                                  </div>
                                  {item.change.why ? (
                                    <div className="mt-1 text-xs text-muted">
                                      Why: {item.change.why}
                                    </div>
                                  ) : null}
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                                    <span>Source: {item.change.source}</span>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${validationToneClass(
                                        validationStatus
                                      )}`}
                                    >
                                      {validationStatus}
                                    </span>
                                    {item.change.source === 'bulkgen' ? (
                                      <form action={validateLogbookChangeNowAction}>
                                        <input
                                          type="hidden"
                                          name="change_id"
                                          value={item.change.change_id}
                                        />
                                        <button
                                          type="submit"
                                          className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2"
                                        >
                                          Validate now
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                  {item.entities.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {item.entities.map((entity) => {
                                        const details = formatEntityDetails(entity);
                                        return (
                                          <div
                                            key={entity.change_entity_id}
                                            className="rounded border border-border bg-surface px-2 py-2"
                                          >
                                            <div className="text-xs font-medium uppercase text-muted">
                                              {entity.entity_type}
                                            </div>
                                            {details.length > 0 ? (
                                              <div className="mt-1 text-xs text-muted">
                                                {details.join(' · ')}
                                              </div>
                                            ) : null}
                                            {entity.note ? (
                                              <div className="mt-1 text-xs text-muted">
                                                Note: {entity.note}
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>

                        {(rawScope || rawEvaluation) && (
                          <details className="rounded-lg border border-border bg-surface-2 p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-foreground">
                              Show raw JSON appendix
                            </summary>
                            {rawScope ? (
                              <div className="mt-3">
                                <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                                  Experiment scope
                                </div>
                                <pre className="overflow-x-auto rounded border border-border bg-surface p-2 text-xs text-muted">
                                  {rawScope}
                                </pre>
                              </div>
                            ) : null}
                            {rawEvaluation ? (
                              <div className="mt-3">
                                <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                                  Latest evaluation metrics_json
                                </div>
                                <pre className="overflow-x-auto rounded border border-border bg-surface p-2 text-xs text-muted">
                                  {rawEvaluation}
                                </pre>
                              </div>
                            ) : null}
                          </details>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-foreground">Unassigned changes</div>
            {logbookUnassigned.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted">
                No unassigned changes.
              </div>
            ) : (
              <div className="space-y-3">
                {logbookUnassigned.map((item) => {
                  const validationStatus =
                    item.change.source === 'bulkgen'
                      ? item.validation?.status ?? 'pending'
                      : 'n/a';
                  return (
                    <div
                      key={item.change.change_id}
                      className="rounded-xl border border-border bg-surface p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {item.change.change_type}
                          </span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted">
                            {item.change.channel}
                          </span>
                        </div>
                        <span className="text-xs text-muted">
                          {formatDateTime(item.change.occurred_at)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-foreground">{item.change.summary}</div>
                      {item.change.why ? (
                        <div className="mt-1 text-xs text-muted">Why: {item.change.why}</div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Source: {item.change.source}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${validationToneClass(
                            validationStatus
                          )}`}
                        >
                          {validationStatus}
                        </span>
                        {item.change.source === 'bulkgen' ? (
                          <form action={validateLogbookChangeNowAction}>
                            <input type="hidden" name="change_id" value={item.change.change_id} />
                            <button
                              type="submit"
                              className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2"
                            >
                              Validate now
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {item.entities.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {item.entities.map((entity) => {
                            const details = formatEntityDetails(entity);
                            return (
                              <div
                                key={entity.change_entity_id}
                                className="rounded border border-border bg-surface-2 px-2 py-2"
                              >
                                <div className="text-xs font-medium uppercase text-muted">
                                  {entity.entity_type}
                                </div>
                                {details.length > 0 ? (
                                  <div className="mt-1 text-xs text-muted">
                                    {details.join(' · ')}
                                  </div>
                                ) : null}
                                {entity.note ? (
                                  <div className="mt-1 text-xs text-muted">
                                    Note: {entity.note}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {!hasLogbookEntries ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
              No logbook entries for this product.
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'changes' ? (
        <section className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted">
                  Product changes
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  Changes Explorer for {asin}
                </div>
                <div className="mt-1 text-sm text-muted">
                  Showing {start} → {end}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/logbook/changes/new?product_id=${encodeURIComponent(asin)}`}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
                >
                  Create change
                </Link>
                <Link
                  href={buildTabHref(asin, 'logbook', start, end)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-2"
                >
                  Open logbook
                </Link>
              </div>
            </div>

            <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="tab" value="changes" />
              <input type="hidden" name="start" value={start} />
              <input type="hidden" name="end" value={end} />
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Channel
                <select
                  name="ch_channel"
                  defaultValue={changesChannel ?? 'all'}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All</option>
                  <option value="sp">SP</option>
                  <option value="sb">SB</option>
                  <option value="sd">SD</option>
                  <option value="non_ads">Non-ads</option>
                </select>
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Source
                <select
                  name="ch_source"
                  defaultValue={changesSource ?? 'all'}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All</option>
                  <option value="bulkgen">bulkgen</option>
                  <option value="manual">manual</option>
                </select>
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Validation
                <select
                  name="ch_validation"
                  defaultValue={changesValidation ?? 'all'}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All</option>
                  <option value="pending">pending</option>
                  <option value="validated">validated</option>
                  <option value="mismatch">mismatch</option>
                  <option value="not_found">not_found</option>
                  <option value="none">none</option>
                </select>
              </label>
              <label className="min-w-[220px] flex-1 text-xs uppercase tracking-wide text-muted">
                Search
                <input
                  type="text"
                  name="ch_q"
                  defaultValue={changesQuery}
                  placeholder="summary, entity ids, experiment"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Apply
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            {changesExplorerRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                No changes match this filter set.
              </div>
            ) : (
              <div className="max-h-[720px] overflow-y-auto">
                <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
                  <table className="w-full min-w-[1400px] table-fixed text-left text-sm">
                    <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted shadow-sm">
                      <tr>
                        <th className="w-44 px-3 py-2">Occurred</th>
                        <th className="w-[30%] px-3 py-2">Summary</th>
                        <th className="w-16 px-3 py-2">Channel</th>
                        <th className="w-36 px-3 py-2">Change Type</th>
                        <th className="w-[24%] px-3 py-2">Entities</th>
                        <th className="w-44 px-3 py-2">Experiment</th>
                        <th className="w-28 px-3 py-2">Validation</th>
                        <th className="w-52 px-3 py-2">Run ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {changesExplorerRows.map((item) => {
                        const diffLines = buildChangeDiffLines(item.change);
                        const rawBefore = formatUnknownJson(item.change.before_json);
                        const rawAfter = formatUnknownJson(item.change.after_json);
                        return (
                          <tr key={item.change.change_id} className="hover:bg-surface-2/70 align-top">
                            <td className="px-3 py-3 text-xs text-muted">
                              {formatDateTime(item.change.occurred_at)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm font-medium text-foreground">{item.change.summary}</div>
                              <div className="mt-1 text-xs text-muted">
                                Source {item.change.source} · {item.change.change_id}
                              </div>
                              <details className="mt-2 rounded border border-border bg-surface px-2 py-1">
                                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
                                  Row detail
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {diffLines.length > 0 ? (
                                    <div>
                                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Diff summary
                                      </div>
                                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
                                        {diffLines.map((line) => (
                                          <li key={`${item.change.change_id}-${line}`}>{line}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted">
                                      No structured before/after diff fields found.
                                    </div>
                                  )}
                                  <details className="rounded border border-border bg-surface-2 px-2 py-2">
                                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
                                      Raw before/after JSON
                                    </summary>
                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                      <div>
                                        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
                                          before_json
                                        </div>
                                        <pre className="overflow-x-auto rounded border border-border bg-surface p-2 text-[11px] text-muted">
                                          {rawBefore ?? 'null'}
                                        </pre>
                                      </div>
                                      <div>
                                        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
                                          after_json
                                        </div>
                                        <pre className="overflow-x-auto rounded border border-border bg-surface p-2 text-[11px] text-muted">
                                          {rawAfter ?? 'null'}
                                        </pre>
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              </details>
                            </td>
                            <td className="px-3 py-3 text-xs uppercase text-muted">{item.change.channel}</td>
                            <td className="px-3 py-3 text-xs text-muted">{item.change.change_type}</td>
                            <td className="px-3 py-3 text-xs text-muted">
                              {item.entities.length === 0 ? (
                                '—'
                              ) : (
                                <div className="space-y-1">
                                  {item.entities.slice(0, 2).map((entity) => (
                                    <div key={entity.change_entity_id}>{formatEntityCompact(entity)}</div>
                                  ))}
                                  {item.entities.length > 2 ? (
                                    <div>+{item.entities.length - 2} more</div>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted">
                              {item.experiment?.experiment_id ? (
                                <Link
                                  href={`/logbook/experiments/${item.experiment.experiment_id}`}
                                  className="font-medium text-foreground hover:underline"
                                >
                                  {item.experiment.name}
                                </Link>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${validationToneClass(
                                  item.validation_status
                                )}`}
                              >
                                {item.validation_status}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-[11px] text-muted">
                              {item.run_id ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </section>
      ) : null}

      {tab === 'costs' ? (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-foreground">Current cost</div>
            {data.currentCosts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                No current cost records.
              </div>
            ) : (
              <div
                data-aph-hscroll
                data-aph-hscroll-axis="x"
                className="overflow-x-auto"
              >
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="w-40 pb-2">SKU</th>
                      <th className="w-28 pb-2">Currency</th>
                      <th className="w-32 pb-2">Landed cost</th>
                      <th className="w-32 pb-2">Valid from</th>
                      <th className="w-32 pb-2">Valid to</th>
                      <th className="w-40 pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.currentCosts.map((row, idx) => (
                      <tr key={`${row.sku ?? 'sku'}-${idx}`}>
                        <td className="py-3 text-muted">{row.sku ?? '—'}</td>
                        <td className="py-3 text-muted">{row.currency ?? '—'}</td>
                        <td className="py-3 text-muted">
                          {formatCurrency(Number(row.landed_cost_per_unit ?? 0))}
                        </td>
                        <td className="py-3 text-muted">{row.valid_from ?? '—'}</td>
                        <td className="py-3 text-muted">{row.valid_to ?? '—'}</td>
                        <td className="py-3 text-muted">{row.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-foreground">Cost history</div>
            {data.costHistory.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                No cost history records.
              </div>
            ) : (
              <div
                data-aph-hscroll
                data-aph-hscroll-axis="x"
                className="overflow-x-auto"
              >
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="w-40 pb-2">SKU ID</th>
                      <th className="w-32 pb-2">Valid from</th>
                      <th className="w-32 pb-2">Valid to</th>
                      <th className="w-28 pb-2">Currency</th>
                      <th className="w-32 pb-2">Landed cost</th>
                      <th className="w-32 pb-2">Supplier</th>
                      <th className="w-40 pb-2">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.costHistory.map((row, idx) => (
                      <tr key={`${row.sku_id ?? 'sku'}-${idx}`}>
                        <td className="py-3 text-muted">{row.sku_id ?? '—'}</td>
                        <td className="py-3 text-muted">{row.valid_from ?? '—'}</td>
                        <td className="py-3 text-muted">{row.valid_to ?? '—'}</td>
                        <td className="py-3 text-muted">{row.currency ?? '—'}</td>
                        <td className="py-3 text-muted">
                          {formatCurrency(Number(row.landed_cost_per_unit ?? 0))}
                        </td>
                        <td className="py-3 text-muted">
                          {formatCurrency(Number(row.supplier_cost ?? 0))}
                        </td>
                        <td className="py-3 text-muted">{row.created_at ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'ads' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <div className="mt-2 text-sm text-muted">
            This section will be wired once the next facts layer is ready.
          </div>
        </section>
      ) : null}

      {tab === 'keywords' && keywordGroups ? (
        <section className="space-y-6">
          <KeywordGroupImport action={importKeywordGroups} />
          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted">
                  Keyword strategy summary
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {keywordGroups.effective_set?.name ?? 'No keyword set yet'}
                </div>
                {!keywordGroups.effective_set ? (
                  <div className="mt-2 text-sm text-muted">
                    Import a keyword group set to enable downloads.
                  </div>
                ) : keywordGroups.active_set ? (
                  <div className="mt-2 text-sm text-muted">
                    Created {keywordGroups.active_set.created_at ?? '—'} ·{' '}
                    {keywordGroups.active_set.is_exclusive ? 'Exclusive' : 'Non-exclusive'}{' '}
                    · Active
                  </div>
                ) : (
                  <>
                    <div className="mt-2 text-sm text-muted">
                      Latest import {keywordGroups.latest_set?.created_at ?? '—'} ·{' '}
                      {keywordGroups.latest_set?.is_exclusive ? 'Exclusive' : 'Non-exclusive'}
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      No active set selected — using latest import for downloads.
                    </div>
                  </>
                )}
                {keywordGroups.multiple_active ? (
                  <div className="mt-2 text-xs text-amber-600">
                    Multiple active sets detected. Please set one active to normalize.
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  Groups{' '}
                  <span className="ml-2 font-semibold text-foreground">
                    {keywordGroups.effective_set?.group_count ?? 0}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  Keywords{' '}
                  <span className="ml-2 font-semibold text-foreground">
                    {keywordGroups.effective_set?.keyword_count ?? 0}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/products/${asin}/keywords/export`}
                download
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                Download grouped CSV
              </a>
              <a
                href={`/products/${asin}/keywords/template`}
                download
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                Download template CSV
              </a>
              <KeywordAiPackDownload
                asin={asin}
                templates={keywordAiPackTemplateOptions}
              />
            </div>
          </div>

          <KeywordGroupSetManager
            asin={asin}
            groupSets={keywordGroups.group_sets}
            setActiveAction={setKeywordGroupSetActive}
            deactivateAction={deactivateKeywordGroupSet}
          />
        </section>
      ) : null}

      {tab === 'sqp' && sqpWeekly ? (
        <section className="space-y-6">
          <ProductSqpTable
            availableWeeks={sqpWeekly.availableWeeks}
            selectedWeekEnd={sqpWeekly.selectedWeekEnd}
            rows={sqpWeekly.rows}
            keywordGroups={keywordGroups}
            keywordGroupMemberships={keywordGroupMemberships}
            trendKey={sqpTrendEnabled ? sqpTrendQuery : null}
            trendMetrics={sqpTrendMetrics}
            trendFrom={sqpTrendFrom}
            trendTo={sqpTrendTo}
            trendAvailableWeeks={sqpTrendAvailableWeeks}
            trendSeries={sqpTrendSeries}
            trendQueryLabel={sqpTrendLabel}
          />
        </section>
      ) : null}

      {tab === 'ranking' ? (
        <section className="space-y-6">
          <ProductRankingHeatmap
            asin={asin}
            start={start}
            end={end}
            rankingRows={rankingRows}
            keywordGroups={keywordGroups}
            keywordGroupMemberships={keywordGroupMemberships}
          />
        </section>
      ) : null}
    </div>
  );
}
