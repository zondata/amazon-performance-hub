'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import type { ProductExperimentPromptTemplateOption } from '@/lib/logbook/productExperimentPromptTemplatesModel';

type ProductExperimentPromptPackDownloadProps = {
  asin: string;
  templates: ProductExperimentPromptTemplateOption[];
};

const STORAGE_KEY = 'aph.productExperimentPromptTemplateId';

const resolveDefaultTemplateId = (
  templates: ProductExperimentPromptTemplateOption[]
): string =>
  templates.find((template) => template.is_default)?.id ??
  templates[0]?.id ??
  'formatting_only';

export default function ProductExperimentPromptPackDownload({
  asin,
  templates,
}: ProductExperimentPromptPackDownloadProps) {
  const defaultTemplateId = useMemo(() => resolveDefaultTemplateId(templates), [templates]);

  const templateIds = useMemo(
    () => new Set(templates.map((template) => template.id)),
    [templates]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplateId);

  useEffect(() => {
    const defaultId = resolveDefaultTemplateId(templates);

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) ?? '';
      if (stored && templateIds.has(stored)) {
        setSelectedTemplateId(stored);
        return;
      }
    } catch {
      // Ignore localStorage read errors and fall back to default.
    }

    setSelectedTemplateId(defaultId);
  }, [templates, templateIds]);

  useEffect(() => {
    if (!templateIds.has(selectedTemplateId)) {
      setSelectedTemplateId(resolveDefaultTemplateId(templates));
    }
  }, [selectedTemplateId, templateIds, templates]);

  const effectiveTemplateId = templateIds.has(selectedTemplateId)
    ? selectedTemplateId
    : defaultTemplateId;

  const handleTemplateChange = (nextId: string) => {
    setSelectedTemplateId(nextId);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      // Ignore localStorage write errors.
    }
  };

  const href = `/products/${asin}/logbook/ai-prompt-pack?template=${encodeURIComponent(
    effectiveTemplateId
  )}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="uppercase tracking-wide">Template</span>
        <select
          value={effectiveTemplateId}
          onChange={(event) => handleTemplateChange(event.target.value)}
          className="min-w-[220px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <a
        href={href}
        download
        className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface"
      >
        Download Product Experiment Prompt Pack
      </a>

      <Link
        href="/settings/logbook-ai-packs"
        className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Manage templates
      </Link>
    </div>
  );
}
