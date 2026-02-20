import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import KpiCards from '@/components/KpiCards';
import KeywordGroupImport from '@/components/KeywordGroupImport';
import KeywordGroupSetManager from '@/components/KeywordGroupSetManager';
import Tabs from '@/components/Tabs';
import TrendChart from '@/components/TrendChart';
import ProductRankingHeatmap from '@/components/ranking/ProductRankingHeatmap';
import ProductSqpTable from '@/components/sqp/ProductSqpTable';
import { parseCsv } from '@/lib/csv/parseCsv';
import { env } from '@/lib/env';
import { ensureProductId } from '@/lib/products/ensureProductId';
import { getProductDetailData } from '@/lib/products/getProductDetailData';
import { getProductKeywordGroups } from '@/lib/products/getProductKeywordGroups';
import { getProductKeywordGroupMemberships } from '@/lib/products/getProductKeywordGroupMemberships';
import { getProductRankingDaily } from '@/lib/ranking/getProductRankingDaily';
import { getProductSqpWeekly } from '@/lib/sqp/getProductSqpWeekly';
import { getProductSqpTrendSeries } from '@/lib/sqp/getProductSqpTrendSeries';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const defaultDateRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return { start: toDateString(start), end: toDateString(end) };
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

  const defaults = defaultDateRange();
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const tab = paramValue('tab') ?? 'overview';
  const errorMessage = paramValue('error');
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

  const saveProductProfile = async (formData: FormData) => {
    'use server';

    const shortNameRaw = formData.get('short_name');
    const notesRaw = formData.get('notes');
    const nextStart = String(formData.get('start') ?? start);
    const nextEnd = String(formData.get('end') ?? end);

    const shortName =
      typeof shortNameRaw === 'string' ? shortNameRaw.trim() : '';
    const notes = typeof notesRaw === 'string' ? notesRaw.trim() : '';

    try {
      const { productId } = await ensureProductId({
        accountId: env.accountId,
        marketplace: env.marketplace,
        asin,
        title: data.productMeta.title ?? undefined,
      });

      let existingProfile: Record<string, unknown> = {};
      const { data: profileRow, error: profileError } = await supabaseAdmin
        .from('product_profile')
        .select('profile_json')
        .eq('product_id', productId)
        .maybeSingle();

      if (profileError) {
        console.error('profile_save:profile_fetch_error', {
          productId,
          error: profileError.message,
        });
      }

      if (
        profileRow?.profile_json &&
        typeof profileRow.profile_json === 'object' &&
        !Array.isArray(profileRow.profile_json)
      ) {
        existingProfile = {
          ...(profileRow.profile_json as Record<string, unknown>),
        };
      }

      const nextProfile = { ...existingProfile };
      if (shortName) {
        nextProfile.short_name = shortName;
      } else {
        delete nextProfile.short_name;
      }

      if (notes) {
        nextProfile.notes = notes;
      } else {
        delete nextProfile.notes;
      }

      const { error: upsertError } = await supabaseAdmin
        .from('product_profile')
        .upsert(
          {
            product_id: productId,
            profile_json: nextProfile,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'product_id' }
        );

      console.log('profile_save', {
        productId,
        shortNameLength: shortName.length,
        error: upsertError?.message ?? null,
      });

      if (upsertError) {
        redirect(
          `/products/${asin}?start=${nextStart}&end=${nextEnd}&tab=overview&error=${encodeURIComponent(
            upsertError.message
          )}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        throw error;
      }
      console.error('profile_save:exception', { asin, error });
      redirect(
        `/products/${asin}?start=${nextStart}&end=${nextEnd}&tab=overview&error=${encodeURIComponent(
          'Failed to save profile.'
        )}`
      );
    }

    redirect(`/products/${asin}?start=${nextStart}&end=${nextEnd}&tab=overview`);
  };

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const data = await getProductDetailData({
    accountId: env.accountId,
    marketplace: env.marketplace,
    asin,
    start,
    end,
  });

  const keywordGroups =
    tab === 'keywords' || tab === 'ranking' || tab === 'sqp'
      ? await getProductKeywordGroups({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
        })
      : null;

  const keywordGroupMemberships =
    (tab === 'ranking' || tab === 'sqp') && keywordGroups?.group_sets?.length
      ? await getProductKeywordGroupMemberships({
          groupSetIds: keywordGroups.group_sets.map((set) => set.group_set_id),
        })
      : null;

  const rankingRows =
    tab === 'ranking'
      ? await getProductRankingDaily({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
        })
      : [];

  const sqpWeekly =
    tab === 'sqp'
      ? await getProductSqpWeekly({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
          weekEnd: sqpWeekEnd,
        })
      : null;

  const sqpTrendResult =
    tab === 'sqp' && sqpTrendEnabled && sqpTrendQuery
      ? await getProductSqpTrendSeries({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          searchQueryNorm: sqpTrendQuery,
          fromWeekEnd: sqpTrendFromRaw,
          toWeekEnd: sqpTrendToRaw,
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
        <div className="space-y-6">
          <KpiCards items={kpiItems} />
          <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">
                Product profile
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                Short name and notes
              </div>
            </div>
            {errorMessage ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {errorMessage}
              </div>
            ) : null}
            <form action={saveProductProfile} className="space-y-4">
              <input type="hidden" name="start" value={start} />
              <input type="hidden" name="end" value={end} />
              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                  Short name
                  <input
                    type="text"
                    name="short_name"
                    defaultValue={shortName ?? ''}
                    placeholder="e.g. Core Bundle"
                    className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <div className="text-xs text-muted">
                  Short names show across filters and headers. Leave blank to clear.
                </div>
              </div>
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Notes (optional)
                <textarea
                  name="notes"
                  defaultValue={data.productMeta.notes ?? ''}
                  placeholder="Optional notes for this product."
                  rows={4}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </label>
              <div>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Save profile
                </button>
              </div>
            </form>
          </section>
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
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-foreground">Logbook</div>
          {data.logbook.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
              No logbook entries for this product.
            </div>
          ) : (
            <div className="space-y-3">
              {data.logbook.map((entry, index) => (
                <div
                  key={`${entry.change_id}-${index}`}
                  className="rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="font-semibold text-foreground">
                      {entry.change_type}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(entry.occurred_at).toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-muted">{entry.summary}</div>
                  {entry.why ? (
                    <div className="mt-1 text-xs text-muted">Why: {entry.why}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-muted">
                    Source: {entry.source}
                  </div>
                </div>
              ))}
            </div>
          )}
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
              <a
                href={`/products/${asin}/keywords/ai-pack`}
                download
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                Download AI formatting pack
              </a>
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
