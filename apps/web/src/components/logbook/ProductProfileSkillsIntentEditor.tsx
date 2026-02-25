'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SkillOption = {
  id: string;
  title: string;
};

type Props = {
  asin: string;
  initialNotes: string;
  initialSkills: string[];
  initialIntent: Record<string, unknown> | null;
  availableSkills: SkillOption[];
};

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

export default function ProductProfileSkillsIntentEditor({
  asin,
  initialNotes,
  initialSkills,
  initialIntent,
  availableSkills,
}: Props) {
  const router = useRouter();
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
          notes,
          skills: selectedSkills,
          intent: parsedIntent,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      setNotice('Saved product notes, skills, and intent.');
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
        <div className="text-xs uppercase tracking-[0.3em] text-muted">AI profile</div>
        <div className="mt-1 text-lg font-semibold text-foreground">Notes, skills, and intent JSON</div>
      </div>

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
