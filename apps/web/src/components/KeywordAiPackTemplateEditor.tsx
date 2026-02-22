'use client';

import { useMemo, useState, useTransition } from 'react';

import { saveKeywordAiPackTemplatesAction } from '@/app/settings/keyword-ai-packs/actions';
import type { KeywordAiPackTemplate } from '@/lib/keywords/keywordAiPackTemplatesModel';

type KeywordAiPackTemplateEditorProps = {
  initialTemplates: KeywordAiPackTemplate[];
};

const slugifyTemplateId = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'template';
};

const ensureSingleDefault = (
  templates: KeywordAiPackTemplate[]
): KeywordAiPackTemplate[] => {
  if (templates.length === 0) return templates;
  const firstDefaultIndex = templates.findIndex((template) => template.is_default);
  if (firstDefaultIndex < 0) {
    return templates.map((template, index) => ({
      ...template,
      is_default: index === 0,
    }));
  }
  return templates.map((template, index) => ({
    ...template,
    is_default: index === firstDefaultIndex,
  }));
};

const uniqueTemplateId = (baseId: string, existingIds: Set<string>): string => {
  if (!existingIds.has(baseId)) return baseId;
  let suffix = 2;
  while (existingIds.has(`${baseId}_${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}_${suffix}`;
};

export default function KeywordAiPackTemplateEditor({
  initialTemplates,
}: KeywordAiPackTemplateEditorProps) {
  const [templates, setTemplates] = useState<KeywordAiPackTemplate[]>(
    ensureSingleDefault(initialTemplates)
  );
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const templateCount = useMemo(() => templates.length, [templates]);

  const updateTemplate = (
    id: string,
    field: 'name' | 'description' | 'instructions_md',
    value: string
  ) => {
    setTemplates((current) =>
      current.map((template) =>
        template.id === id ? { ...template, [field]: value } : template
      )
    );
    setSavedMessage('');
    setErrorMessage('');
  };

  const setDefaultTemplate = (id: string) => {
    setTemplates((current) =>
      current.map((template) => ({
        ...template,
        is_default: template.id === id,
      }))
    );
    setSavedMessage('');
    setErrorMessage('');
  };

  const addTemplate = () => {
    setTemplates((current) => {
      const ids = new Set(current.map((template) => template.id));
      const baseId = slugifyTemplateId('New template');
      const id = uniqueTemplateId(baseId, ids);
      return [
        ...current,
        {
          id,
          name: 'New template',
          description: '',
          instructions_md: '',
          is_default: current.length === 0,
        },
      ];
    });
    setSavedMessage('');
    setErrorMessage('');
  };

  const removeTemplate = (id: string) => {
    setTemplates((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((template) => template.id !== id);
      return ensureSingleDefault(next);
    });
    setSavedMessage('');
    setErrorMessage('');
  };

  const saveTemplates = () => {
    setSavedMessage('');
    setErrorMessage('');
    startTransition(async () => {
      try {
        const sanitized = ensureSingleDefault(templates);
        await saveKeywordAiPackTemplatesAction(sanitized);
        setTemplates(sanitized);
        setSavedMessage('Saved');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to save templates.';
        setErrorMessage(message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          Templates: <span className="font-semibold text-foreground">{templateCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addTemplate}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
          >
            Add template
          </button>
          <button
            type="button"
            onClick={saveTemplates}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {savedMessage ? <div className="text-sm text-emerald-600">{savedMessage}</div> : null}
      {errorMessage ? <div className="text-sm text-rose-600">{errorMessage}</div> : null}

      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Template ID</div>
                <div className="mt-1 text-sm font-mono text-foreground">{template.id}</div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="radio"
                    name="keyword-ai-pack-default"
                    checked={template.is_default}
                    onChange={() => setDefaultTemplate(template.id)}
                  />
                  Default
                </label>
                <button
                  type="button"
                  onClick={() => removeTemplate(template.id)}
                  disabled={templates.length <= 1}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Name
                <input
                  type="text"
                  value={template.name}
                  onChange={(event) =>
                    updateTemplate(template.id, 'name', event.target.value)
                  }
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </label>

              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Description
                <input
                  type="text"
                  value={template.description}
                  onChange={(event) =>
                    updateTemplate(template.id, 'description', event.target.value)
                  }
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>

            <label className="mt-3 flex flex-col text-xs uppercase tracking-wide text-muted">
              Instructions (Markdown)
              <textarea
                value={template.instructions_md}
                onChange={(event) =>
                  updateTemplate(template.id, 'instructions_md', event.target.value)
                }
                rows={12}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
