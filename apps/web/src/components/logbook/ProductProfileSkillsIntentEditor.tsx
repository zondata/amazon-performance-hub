'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SkillOption = {
  id: string;
  title: string;
};

type ResolvedSkillOption = {
  id: string;
  title: string;
  tags: string[];
  applies_to: string[];
  content_md: string;
};

type Props = {
  asin: string;
  initialShortName: string;
  initialNotes: string;
  initialSkills: string[];
  initialIntent: Record<string, unknown> | null;
  availableSkills: SkillOption[];
  resolvedSkillLibrary: ResolvedSkillOption[];
  resolvedSelectedSkills: ResolvedSkillOption[];
};

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

export default function ProductProfileSkillsIntentEditor({
  asin,
  initialShortName,
  initialNotes,
  initialSkills,
  initialIntent,
  availableSkills,
  resolvedSkillLibrary,
  resolvedSelectedSkills,
}: Props) {
  const router = useRouter();
  const [shortName, setShortName] = useState(initialShortName);
  const [notes, setNotes] = useState(initialNotes);
  const [intentText, setIntentText] = useState(() =>
    initialIntent ? JSON.stringify(initialIntent, null, 2) : ''
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialSkills);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedSkillOptions = useMemo(() => {
    const byId = new Map<string, SkillOption>();
    for (const skill of availableSkills) {
      byId.set(skill.id, skill);
    }
    const selectedMissing = selectedSkills
      .filter((id) => !byId.has(id))
      .map((id) => ({ id, title: '(unknown skill)' }));

    return [...availableSkills, ...selectedMissing];
  }, [availableSkills, selectedSkills]);

  const skillLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    orderedSkillOptions.forEach((skill) => {
      labels.set(skill.id, skill.title);
    });
    return labels;
  }, [orderedSkillOptions]);

  const resolvedSkillById = useMemo(() => {
    const map = new Map<string, ResolvedSkillOption>();
    resolvedSelectedSkills.forEach((skill) => {
      map.set(skill.id, skill);
    });
    return map;
  }, [resolvedSelectedSkills]);

  const skillLibraryById = useMemo(() => {
    const map = new Map<string, ResolvedSkillOption>();
    resolvedSkillLibrary.forEach((skill) => {
      map.set(skill.id, skill);
    });
    return map;
  }, [resolvedSkillLibrary]);

  const selectedSkillDetails = useMemo(
    () =>
      selectedSkills.map((id) => {
        const fromLibrary = skillLibraryById.get(id);
        if (fromLibrary) {
          return fromLibrary;
        }
        const resolved = resolvedSkillById.get(id);
        if (resolved) {
          return resolved;
        }
        return {
          id,
          title: skillLabelById.get(id) ?? '(unknown skill)',
          tags: [],
          applies_to: [],
          content_md: '',
        };
      }),
    [resolvedSkillById, selectedSkills, skillLabelById, skillLibraryById]
  );

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((current) => {
      if (current.includes(skillId)) {
        return current.filter((entry) => entry !== skillId);
      }
      return [...current, skillId];
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const trimmedShortName = shortName.trim();
      let parsedIntent: Record<string, unknown> | null = null;
      const trimmedIntent = intentText.trim();
      if (trimmedIntent.length > 0) {
        const rawParsed = JSON.parse(trimmedIntent) as unknown;
        if (!rawParsed || typeof rawParsed !== 'object' || Array.isArray(rawParsed)) {
          throw new Error('intent must be a JSON object.');
        }
        parsedIntent = rawParsed as Record<string, unknown>;
      }

      const response = await fetch(`/products/${encodeURIComponent(asin)}/profile/update`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          short_name: trimmedShortName.length > 0 ? trimmedShortName : null,
          notes,
          skills: selectedSkills,
          intent: parsedIntent,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      setNotice('Saved profile context.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save profile context.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Profile context</div>
        <div className="mt-1 text-lg font-semibold text-foreground">
          Short name, notes, skills, and intent JSON
        </div>
      </div>

      <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
        <span>Short name</span>
        <input
          value={shortName}
          onChange={(event) => setShortName(event.target.value)}
          type="text"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          placeholder="e.g. Core Bundle"
        />
      </label>

      <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          placeholder="Operator notes for this product."
        />
      </label>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted">Skills</div>
        <div className="flex flex-wrap gap-2">
          {selectedSkills.length === 0 ? (
            <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
              No skills selected
            </span>
          ) : (
            selectedSkills.map((skillId) => (
              <span
                key={skillId}
                className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-foreground"
              >
                {skillId}
                <span className="ml-1 text-muted">· {skillLabelById.get(skillId) ?? '(unknown)'}</span>
              </span>
            ))
          )}
        </div>
        {orderedSkillOptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
            No skill definitions found in docs/skills/library.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {orderedSkillOptions.map((skill) => (
              <label
                key={skill.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={selectedSkills.includes(skill.id)}
                  onChange={() => toggleSkill(skill.id)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="font-medium">{skill.id}</span>
                  <span className="ml-2 text-xs text-muted">{skill.title}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted">Resolved skill SOP</div>
        {selectedSkillDetails.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
            Select skills to view SOP context.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedSkillDetails.map((skill) => (
              <details key={skill.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  {skill.id} · {skill.title}
                </summary>
                <div className="mt-2 space-y-2 text-xs text-muted">
                  <div>
                    tags: {skill.tags.length > 0 ? skill.tags.join(', ') : '—'}
                  </div>
                  <div>
                    applies_to: {skill.applies_to.length > 0 ? skill.applies_to.join(', ') : '—'}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-foreground">
                    {skill.content_md || 'No resolved SOP content.'}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted">Skill library</div>
        {resolvedSkillLibrary.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
            No skill definitions found in docs/skills/library.
          </div>
        ) : (
          <div className="space-y-2">
            {resolvedSkillLibrary.map((skill) => (
              <details key={skill.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  {skill.id} · {skill.title}
                </summary>
                <div className="mt-2 space-y-2 text-xs text-muted">
                  <div>
                    tags: {skill.tags.length > 0 ? skill.tags.join(', ') : '—'}
                  </div>
                  <div>
                    applies_to: {skill.applies_to.length > 0 ? skill.applies_to.join(', ') : '—'}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-foreground">
                    {skill.content_md || 'No skill content.'}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
        <span>Intent (JSON object)</span>
        <textarea
          value={intentText}
          onChange={(event) => setIntentText(event.target.value)}
          rows={8}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
          placeholder='{"goal":"protect rank","constraints":{"acos_max":0.35}}'
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <div className="min-h-5 text-xs">
          {notice ? <span className="text-emerald-700">{notice}</span> : null}
          {error ? <span className="text-rose-700">{error}</span> : null}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Save profile context'}
        </button>
      </div>
    </div>
  );
}
