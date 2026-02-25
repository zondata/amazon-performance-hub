'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { useLocalStorageString } from '@/lib/hooks/useLocalStorageString';

type KeywordAiPackDownloadProps = {
  asin: string;
  templates: Array<{ id: string; name: string; is_default: boolean }>;
};

const STORAGE_KEY = 'aph.keywordAiPackTemplateId';

const resolveDefaultTemplateId = (
  templates: Array<{ id: string; name: string; is_default: boolean }>
): string =>
  templates.find((template) => template.is_default)?.id ?? templates[0]?.id ?? 'formatting_only';

export default function KeywordAiPackDownload({
  asin,
  templates,
}: KeywordAiPackDownloadProps) {
  const defaultId = resolveDefaultTemplateId(templates);
  const storedTemplateId = useLocalStorageString(STORAGE_KEY, '');

  const templateIds = useMemo(
    () => new Set(templates.map((template) => template.id)),
    [templates]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const effectiveStoredTemplateId =
    storedTemplateId && templateIds.has(storedTemplateId) ? storedTemplateId : '';
  const effectiveSelectedTemplateId =
    (selectedTemplateId && templateIds.has(selectedTemplateId) ? selectedTemplateId : '') ||
    effectiveStoredTemplateId ||
    defaultId;

  const handleTemplateChange = (nextId: string) => {
    setSelectedTemplateId(nextId);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      // Ignore localStorage write errors.
    }
  };

  const href = `/products/${asin}/keywords/ai-pack?template=${encodeURIComponent(
    effectiveSelectedTemplateId
  )}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="uppercase tracking-wide">Template</span>
        <select
          value={effectiveSelectedTemplateId}
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
        className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
      >
        Download Keyword AI pack
      </a>

      <Link
        href="/settings/keyword-ai-packs"
        className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Manage templates
      </Link>
    </div>
  );
}
