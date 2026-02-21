'use client';

import { useMemo, useState } from 'react';

const ENTITY_TYPES = [
  'campaign',
  'ad_group',
  'target',
  'keyword',
  'product',
  'portfolio',
  'placement',
];

type EntityLink = {
  id: string;
  entity_type: string;
  product_id: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string;
  keyword_id: string;
  note: string;
};

type EntityLinkSeed = Partial<Omit<EntityLink, 'id'>>;

type EntityLinksEditorProps = {
  namePrefix?: string;
  initialLinks?: EntityLinkSeed[];
  initialProductId?: string;
};

const blankLink = (seed?: EntityLinkSeed): EntityLink => ({
  id: `entity-${Math.random().toString(36).slice(2, 9)}`,
  entity_type: seed?.entity_type ?? '',
  product_id: seed?.product_id ?? '',
  campaign_id: seed?.campaign_id ?? '',
  ad_group_id: seed?.ad_group_id ?? '',
  target_id: seed?.target_id ?? '',
  keyword_id: seed?.keyword_id ?? '',
  note: seed?.note ?? '',
});

const initialEntityLinks = ({
  initialLinks,
  initialProductId,
}: Pick<EntityLinksEditorProps, 'initialLinks' | 'initialProductId'>): EntityLink[] => {
  if (initialLinks && initialLinks.length > 0) {
    return initialLinks.map((row) => blankLink(row));
  }

  const trimmedProductId = initialProductId?.trim();
  if (trimmedProductId) {
    return [blankLink({ entity_type: 'product', product_id: trimmedProductId })];
  }

  return [blankLink()];
};

export default function EntityLinksEditor({
  namePrefix = 'entities',
  initialLinks,
  initialProductId,
}: EntityLinksEditorProps) {
  const [links, setLinks] = useState<EntityLink[]>(() =>
    initialEntityLinks({ initialLinks, initialProductId })
  );

  const indexedLinks = useMemo(
    () =>
      links.map((link, index) => ({
        ...link,
        index,
      })),
    [links]
  );

  const updateLink = (id: string, field: keyof EntityLink, value: string) => {
    setLinks((prev) =>
      prev.map((link) => (link.id === id ? { ...link, [field]: value } : link))
    );
  };

  const addLink = () => setLinks((prev) => [...prev, blankLink()]);

  const removeLink = (id: string) => {
    setLinks((prev) => (prev.length === 1 ? prev : prev.filter((link) => link.id !== id)));
  };

  return (
    <div className="space-y-3">
      {indexedLinks.map((link) => (
        <div key={link.id} className="rounded-xl border border-slate-200 bg-white/80 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-slate-400">Entity link</div>
            <button
              type="button"
              onClick={() => removeLink(link.id)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Remove
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-400">Entity type</label>
              <select
                name={`${namePrefix}[${link.index}].entity_type`}
                value={link.entity_type}
                onChange={(event) => updateLink(link.id, 'entity_type', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select</option>
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-400">Product ID / ASIN</label>
              <input
                name={`${namePrefix}[${link.index}].product_id`}
                value={link.product_id}
                onChange={(event) => updateLink(link.id, 'product_id', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="ASIN or product id"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-400">Campaign ID</label>
              <input
                name={`${namePrefix}[${link.index}].campaign_id`}
                value={link.campaign_id}
                onChange={(event) => updateLink(link.id, 'campaign_id', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-400">Ad group ID</label>
              <input
                name={`${namePrefix}[${link.index}].ad_group_id`}
                value={link.ad_group_id}
                onChange={(event) => updateLink(link.id, 'ad_group_id', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-400">Target ID</label>
              <input
                name={`${namePrefix}[${link.index}].target_id`}
                value={link.target_id}
                onChange={(event) => updateLink(link.id, 'target_id', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-400">Keyword ID</label>
              <input
                name={`${namePrefix}[${link.index}].keyword_id`}
                value={link.keyword_id}
                onChange={(event) => updateLink(link.id, 'keyword_id', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs uppercase tracking-wider text-slate-400">Note</label>
              <input
                name={`${namePrefix}[${link.index}].note`}
                value={link.note}
                onChange={(event) => updateLink(link.id, 'note', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Optional note"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addLink}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-900"
      >
        Add entity link
      </button>
    </div>
  );
}
