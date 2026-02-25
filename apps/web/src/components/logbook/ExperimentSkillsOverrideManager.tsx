'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SkillOption = {
  id: string;
  title: string;
};

type Props = {
  experimentId: string;
  initialSkills: string[];
  availableSkills: SkillOption[];
};

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

export default function ExperimentSkillsOverrideManager({
  experimentId,
  initialSkills,
  availableSkills,
}: Props) {
  const router = useRouter();
  const [selectedSkills, setSelectedSkills] = useState(initialSkills);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const byId = new Set(availableSkills.map((skill) => skill.id));
    const missing = selectedSkills
      .filter((skillId) => !byId.has(skillId))
      .map((skillId) => ({ id: skillId, title: '(unknown skill)' }));
    return [...availableSkills, ...missing];
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
    setNotice(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        `/logbook/experiments/${encodeURIComponent(experimentId)}/scope/update`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            skills: selectedSkills,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      setNotice('Experiment scope skills saved.');
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to save experiment skills.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-foreground">Experiment skills override</div>
      {options.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
          No skills found in docs/skills/library.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {options.map((skill) => (
            <label
              key={skill.id}
              className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-h-5 text-xs">
          {notice ? <span className="text-emerald-700">{notice}</span> : null}
          {error ? <span className="text-rose-700">{error}</span> : null}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save experiment skills'}
        </button>
      </div>
    </div>
  );
}
