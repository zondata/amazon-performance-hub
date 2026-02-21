import { redirect } from 'next/navigation';

import PageHeader from '@/components/PageHeader';
import JSONTextarea from '@/components/JSONTextarea';
import EntityLinksEditor from '@/components/logbook/EntityLinksEditor';
import { createChange } from '@/lib/logbook/createChange';
import { linkChangesToExperiment } from '@/lib/logbook/linkChangesToExperiment';
import { safeParseJson } from '@/lib/logbook/validation';

const defaultOccurredAt = () => new Date().toISOString().slice(0, 16);

const parseEntities = (formData: FormData) => {
  const entries = Array.from(formData.entries()).filter(([key]) => key.startsWith('entities['));
  const grouped: Record<number, Record<string, string>> = {};

  entries.forEach(([key, value]) => {
    const match = key.match(/^entities\[(\d+)\]\.([\w_]+)$/);
    if (!match) return;
    const index = Number(match[1]);
    if (!grouped[index]) grouped[index] = {};
    grouped[index][match[2]] = String(value);
  });

  return Object.values(grouped).map((entity) => ({
    entity_type: entity.entity_type ?? '',
    product_id: entity.product_id ?? '',
    campaign_id: entity.campaign_id ?? '',
    ad_group_id: entity.ad_group_id ?? '',
    target_id: entity.target_id ?? '',
    keyword_id: entity.keyword_id ?? '',
    note: entity.note ?? '',
  }));
};

type NewChangePageProps = {
  searchParams?:
    | Promise<{
        experiment_id?: string;
        product_id?: string;
      }>
    | {
        experiment_id?: string;
        product_id?: string;
      };
};

export default async function NewChangePage({ searchParams }: NewChangePageProps) {
  const resolvedSearchParams =
    searchParams instanceof Promise ? await searchParams : searchParams;
  const initialProductId = resolvedSearchParams?.product_id?.trim().toUpperCase();

  const handleSubmit = async (formData: FormData) => {
    'use server';

    const beforeRaw = String(formData.get('before_json') ?? '');
    const afterRaw = String(formData.get('after_json') ?? '');

    const parsedBefore = safeParseJson(beforeRaw, 'Before JSON');
    const parsedAfter = safeParseJson(afterRaw, 'After JSON');

    if (parsedBefore.error || parsedAfter.error) {
      throw new Error(parsedBefore.error ?? parsedAfter.error ?? 'Invalid JSON');
    }

    const entities = parseEntities(formData);

    const changeId = await createChange({
      occurred_at: String(formData.get('occurred_at') ?? ''),
      channel: String(formData.get('channel') ?? ''),
      change_type: String(formData.get('change_type') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      why: String(formData.get('why') ?? ''),
      source: String(formData.get('source') ?? 'manual'),
      before_json: parsedBefore.value ?? null,
      after_json: parsedAfter.value ?? null,
      entities,
    });

    if (resolvedSearchParams?.experiment_id) {
      await linkChangesToExperiment(resolvedSearchParams.experiment_id, [changeId]);
      redirect(`/logbook/experiments/${resolvedSearchParams.experiment_id}`);
    }

    redirect('/logbook/changes');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New change"
        subtitle="Capture campaign and operational changes with context."
      />

      <form action={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Occurred at</label>
              <input
                type="datetime-local"
                name="occurred_at"
                defaultValue={defaultOccurredAt()}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Source</label>
              <select
                name="source"
                defaultValue="manual"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="manual">manual</option>
                <option value="bulkgen">bulkgen</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Channel</label>
              <input
                name="channel"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="sp"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Change type</label>
              <input
                name="change_type"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="budget_update"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Summary</label>
              <input
                name="summary"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-400">Why</label>
              <textarea
                name="why"
                className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <JSONTextarea
              label="Before JSON"
              name="before_json"
              helperText="Optional JSON snapshot before the change."
            />
            <JSONTextarea
              label="After JSON"
              name="after_json"
              helperText="Optional JSON snapshot after the change."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="mb-4 text-xs uppercase tracking-wider text-slate-400">Entity links</div>
          <EntityLinksEditor initialProductId={initialProductId} />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Create change
          </button>
        </div>
      </form>
    </div>
  );
}
