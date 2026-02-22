'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    resolveDefaultTemplateId(templates)
  );

  const templateIds = useMemo(() => new Set(templates.map((template) => template.id)), [templates]);

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
  }, [templateIds, templates]);

  useEffect(() => {
    if (!templateIds.has(selectedTemplateId)) {
      setSelectedTemplateId(resolveDefaultTemplateId(templates));
    }
  }, [selectedTemplateId, templateIds, templates]);

  const handleTemplateChange = (nextId: string) => {
    setSelectedTemplateId(nextId);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      // Ignore localStorage write errors.
    }
  };

  const href = `/products/${asin}/keywords/ai-pack?template=${encodeURIComponent(
    selectedTemplateId
  )}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="uppercase tracking-wide">Template</span>
        <select
          value={selectedTemplateId}
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
