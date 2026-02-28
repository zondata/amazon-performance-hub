'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';

import { intentToUi, type IntentUi, uiToIntent } from '@/lib/products/productIntentUiModel';
import { groupSkillsByPrimaryStage } from '@/lib/skills/groupSkills';

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
  version?: string;
};

type Props = {
  asin: string;
  displayName: string;
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

const KNOWN_INTENT_KEYS = new Set([
  'summary',
  'goal',
  'text',
  'constraints',
  'avoid',
  'do_not',
  'notes',
]);

const dedupeSkillIds = (skillIds: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const idRaw of skillIds) {
    const id = idRaw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
};

const formatIntentValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export default function ProductProfileSkillsIntentEditor({
  asin,
  displayName,
  initialShortName,
  initialNotes,
  initialSkills,
  initialIntent,
  availableSkills,
  resolvedSkillLibrary,
  resolvedSelectedSkills,
}: Props) {
  const router = useRouter();
  const initialIntentKey = useMemo(() => JSON.stringify(initialIntent ?? null), [initialIntent]);
  const initialSkillsKey = useMemo(() => initialSkills.join('\u001f'), [initialSkills]);

  const [savedShortName, setSavedShortName] = useState(initialShortName);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [savedSkills, setSavedSkills] = useState<string[]>(() => dedupeSkillIds(initialSkills));
  const [savedIntent, setSavedIntent] = useState<Record<string, unknown> | null>(initialIntent);

  const [isEditing, setIsEditing] = useState(false);
  const [editShortName, setEditShortName] = useState(initialShortName);
  const [editNotes, setEditNotes] = useState(initialNotes);
  const [editSkills, setEditSkills] = useState<string[]>(() => dedupeSkillIds(initialSkills));
  const [editIntent, setEditIntent] = useState<IntentUi>(() => intentToUi(initialIntent));
  const [skillSearch, setSkillSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intentPromptRef = useRef<HTMLTextAreaElement | null>(null);
  const skillPromptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const nextIntent = initialIntentKey === 'null' ? null : (JSON.parse(initialIntentKey) as Record<string, unknown>);
    const nextSkills = dedupeSkillIds(initialSkillsKey ? initialSkillsKey.split('\u001f') : []);

    setSavedShortName(initialShortName);
    setSavedNotes(initialNotes);
    setSavedSkills(nextSkills);
    setSavedIntent(nextIntent);

    setEditShortName(initialShortName);
    setEditNotes(initialNotes);
    setEditSkills(nextSkills);
    setEditIntent(intentToUi(nextIntent));

    setSkillSearch('');
    setIsEditing(false);
  }, [initialIntentKey, initialNotes, initialShortName, initialSkillsKey]);

  const fallbackSkillTitleById = useMemo(() => {
    const map = new Map<string, string>();

    for (const skill of availableSkills) {
      map.set(skill.id, skill.title);
    }
    for (const skill of resolvedSelectedSkills) {
      map.set(skill.id, skill.title);
    }
    for (const skill of resolvedSkillLibrary) {
      map.set(skill.id, skill.title);
    }

    return map;
  }, [availableSkills, resolvedSelectedSkills, resolvedSkillLibrary]);

  const resolvedSkillById = useMemo(() => {
    const map = new Map<string, ResolvedSkillOption>();

    for (const skill of resolvedSkillLibrary) {
      map.set(skill.id, skill);
    }
    for (const skill of resolvedSelectedSkills) {
      if (!map.has(skill.id)) {
        map.set(skill.id, skill);
      }
    }

    return map;
  }, [resolvedSelectedSkills, resolvedSkillLibrary]);

  const selectedSkillDetails = useMemo(() => {
    return savedSkills.map((skillId) => {
      const resolved = resolvedSkillById.get(skillId);
      if (resolved) return resolved;

      return {
        id: skillId,
        title: fallbackSkillTitleById.get(skillId) ?? '(unknown skill)',
        tags: [],
        applies_to: [],
        content_md: '',
      } satisfies ResolvedSkillOption;
    });
  }, [fallbackSkillTitleById, resolvedSkillById, savedSkills]);

  const editableSkillCatalog = useMemo(() => {
    const byId = new Map<string, ResolvedSkillOption>();

    for (const skill of resolvedSkillLibrary) {
      byId.set(skill.id, skill);
    }

    for (const skillId of editSkills) {
      if (byId.has(skillId)) continue;
      const resolvedSelected = resolvedSkillById.get(skillId);
      if (resolvedSelected) {
        byId.set(skillId, resolvedSelected);
        continue;
      }

      byId.set(skillId, {
        id: skillId,
        title: fallbackSkillTitleById.get(skillId) ?? '(unknown skill)',
        tags: [],
        applies_to: [],
        content_md: '',
      });
    }

    return Array.from(byId.values());
  }, [editSkills, fallbackSkillTitleById, resolvedSkillById, resolvedSkillLibrary]);

  const filteredEditableSkillCatalog = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    if (!query) return editableSkillCatalog;

    return editableSkillCatalog.filter((skill) => {
      const haystack = [
        skill.id,
        skill.title,
        skill.tags.join(' '),
        skill.applies_to.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [editableSkillCatalog, skillSearch]);

  const groupedEditableSkills = useMemo(
    () => groupSkillsByPrimaryStage(filteredEditableSkillCatalog),
    [filteredEditableSkillCatalog]
  );

  const isSkillSelectedInEdit = (skillId: string) => editSkills.includes(skillId);

  const toggleSkill = (skillId: string) => {
    setEditSkills((current) => {
      if (current.includes(skillId)) {
        return current.filter((entry) => entry !== skillId);
      }
      return [...current, skillId];
    });
  };

  const currentIntentUi = useMemo(() => intentToUi(savedIntent), [savedIntent]);
  const intentAdvancedEntries = useMemo(() => {
    if (!savedIntent) return [] as Array<{ key: string; value: unknown }>;
    return Object.entries(savedIntent)
      .filter(([key]) => !KNOWN_INTENT_KEYS.has(key))
      .map(([key, value]) => ({ key, value }))
      .sort((left, right) => left.key.localeCompare(right.key));
  }, [savedIntent]);

  const hasVisibleIntent =
    currentIntentUi.summary.length > 0 ||
    currentIntentUi.constraints.length > 0 ||
    currentIntentUi.avoid.length > 0 ||
    currentIntentUi.notes.length > 0 ||
    intentAdvancedEntries.length > 0;

  const selectedSkillIdsText = useMemo(() => {
    if (savedSkills.length === 0) return '(none)';
    return savedSkills.join(', ');
  }, [savedSkills]);

  const intentPromptText = useMemo(
    () =>
      [
        'You are helping update product-level intent for Amazon ads diagnostics.',
        '',
        'Product context:',
        `- ASIN: ${asin}`,
        `- Display name: ${displayName || asin}`,
        `- Notes: ${savedNotes.trim() || '(none)'}`,
        `- Selected skills: ${selectedSkillIdsText}`,
        '',
        'Current intent fields:',
        `- summary: ${currentIntentUi.summary || '(empty)'}`,
        `- constraints: ${currentIntentUi.constraints || '(empty)'}`,
        `- avoid: ${currentIntentUi.avoid || '(empty)'}`,
        `- notes: ${currentIntentUi.notes || '(empty)'}`,
        '',
        'Task:',
        '1) Improve the intent for a human operator.',
        '2) Return ONLY a JSON object with keys: summary, constraints, avoid, notes.',
        '3) constraints and avoid must be arrays of short strings.',
        '4) Keep language concrete and operational.',
      ].join('\n'),
    [asin, currentIntentUi.avoid, currentIntentUi.constraints, currentIntentUi.notes, currentIntentUi.summary, displayName, savedNotes, selectedSkillIdsText]
  );

  const skillDraftPromptText = useMemo(
    () =>
      [
        'Draft a new skill markdown file for docs/skills/library/.',
        '',
        'Product context:',
        `- ASIN: ${asin}`,
        `- Display name: ${displayName || asin}`,
        `- Product notes: ${savedNotes.trim() || '(none)'}`,
        `- Existing selected skill IDs: ${selectedSkillIdsText}`,
        '',
        'Output requirements:',
        '1) Return markdown only.',
        '2) Include YAML frontmatter with: id, title, version, tags, applies_to.',
        '3) applies_to may only include: analysis, planning, execution, evaluation.',
        '4) Body must include SOP rules, why the rule exists, and risks/tradeoffs if skipped.',
        '5) Keep the SOP practical and concise.',
      ].join('\n'),
    [asin, displayName, savedNotes, selectedSkillIdsText]
  );

  const copyPrompt = async (text: string, fallbackRef: RefObject<HTMLTextAreaElement | null>) => {
    setError(null);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setNotice('Prompt copied.');
        return;
      }
    } catch {
      // Fall through to manual copy mode.
    }

    const fallbackElement = fallbackRef.current;
    if (fallbackElement) {
      fallbackElement.focus();
      fallbackElement.select();
      fallbackElement.setSelectionRange(0, fallbackElement.value.length);
    }

    setNotice('Clipboard unavailable. Prompt selected for manual copy.');
  };

  const startEditing = () => {
    setEditShortName(savedShortName);
    setEditNotes(savedNotes);
    setEditSkills(savedSkills);
    setEditIntent(intentToUi(savedIntent));
    setSkillSearch('');
    setNotice(null);
    setError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditShortName(savedShortName);
    setEditNotes(savedNotes);
    setEditSkills(savedSkills);
    setEditIntent(intentToUi(savedIntent));
    setSkillSearch('');
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const trimmedShortName = editShortName.trim();
      const normalizedNotes = editNotes.trim();
      const normalizedSkills = dedupeSkillIds(editSkills);
      const nextIntent = uiToIntent(editIntent, savedIntent);

      const response = await fetch(`/products/${encodeURIComponent(asin)}/profile/update`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          short_name: trimmedShortName.length > 0 ? trimmedShortName : null,
          notes: normalizedNotes,
          skills: normalizedSkills,
          intent: nextIntent,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      setSavedShortName(trimmedShortName);
      setSavedNotes(normalizedNotes);
      setSavedSkills(normalizedSkills);
      setSavedIntent(nextIntent);

      setEditShortName(trimmedShortName);
      setEditNotes(normalizedNotes);
      setEditSkills(normalizedSkills);
      setEditIntent(intentToUi(nextIntent));

      setNotice('Saved profile context.');
      setSkillSearch('');
      setIsEditing(false);

      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save profile context.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const chipsToRender = isEditing ? editSkills : savedSkills;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Profile context</div>
          <div className="mt-1 text-lg font-semibold text-foreground">Short name, notes, skills, and intent</div>
        </div>
        {isEditing ? null : (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground"
          >
            Edit
          </button>
        )}
      </div>

      {notice ? (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground">
          {error}
        </div>
      ) : null}

      {isEditing ? (
        <>
          <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
            <span>Short name</span>
            <input
              value={editShortName}
              onChange={(event) => setEditShortName(event.target.value)}
              type="text"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              placeholder="e.g. Core Bundle"
            />
          </label>

          <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
            <span>Notes</span>
            <textarea
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              placeholder="Operator notes for this product."
            />
          </label>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">Skills</div>
            <div className="flex flex-wrap gap-2">
              {chipsToRender.length === 0 ? (
                <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                  No skills selected
                </span>
              ) : (
                chipsToRender.map((skillId) => (
                  <span
                    key={skillId}
                    className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-foreground"
                  >
                    {skillId}
                    <span className="ml-1 text-muted">
                      {fallbackSkillTitleById.get(skillId)
                        ? `- ${fallbackSkillTitleById.get(skillId)}`
                        : ''}
                    </span>
                  </span>
                ))
              )}
            </div>

            <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
              <span>Search skills</span>
              <input
                value={skillSearch}
                onChange={(event) => setSkillSearch(event.target.value)}
                type="search"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                placeholder="Search by id, title, stage, or tag"
              />
            </label>

            {groupedEditableSkills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                No skills match the current filter.
              </div>
            ) : (
              <div className="space-y-2">
                {groupedEditableSkills.map((group) => (
                  <details key={group.key} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground">
                      {group.label} ({group.skills.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {group.skills.map((skill) => {
                        const details = resolvedSkillById.get(skill.id) ?? {
                          id: skill.id,
                          title: skill.title,
                          tags: skill.tags,
                          applies_to: skill.applies_to,
                          content_md: '',
                        };

                        return (
                          <div key={skill.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                            <label className="flex items-start gap-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={isSkillSelectedInEdit(skill.id)}
                                onChange={() => toggleSkill(skill.id)}
                                className="mt-0.5 h-4 w-4 rounded border-border"
                              />
                              <span>
                                <span className="font-medium">{skill.id}</span>
                                <span className="ml-2 text-muted">{skill.title}</span>
                              </span>
                            </label>
                            <details className="mt-2 rounded-lg border border-border bg-surface px-3 py-2">
                              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
                                Preview SOP
                              </summary>
                              <div className="mt-2 space-y-2 text-xs text-muted">
                                <div>
                                  tags: {details.tags.length > 0 ? details.tags.join(', ') : '-'}
                                </div>
                                <div>
                                  applies_to:{' '}
                                  {details.applies_to.length > 0 ? details.applies_to.join(', ') : '-'}
                                </div>
                                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-foreground">
                                  {details.content_md || 'No skill content.'}
                                </pre>
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">Intent</div>
            <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
              <span>Summary</span>
              <textarea
                value={editIntent.summary}
                onChange={(event) =>
                  setEditIntent((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                placeholder="One-sentence operating intent for this product."
              />
            </label>
            <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
              <span>Constraints (one per line)</span>
              <textarea
                value={editIntent.constraints}
                onChange={(event) =>
                  setEditIntent((current) => ({
                    ...current,
                    constraints: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                placeholder="acos <= 0.35"
              />
            </label>
            <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
              <span>Avoid (one per line)</span>
              <textarea
                value={editIntent.avoid}
                onChange={(event) =>
                  setEditIntent((current) => ({
                    ...current,
                    avoid: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                placeholder="Do not raise bids on low-intent terms"
              />
            </label>
            <label className="block space-y-1 text-xs uppercase tracking-wide text-muted">
              <span>Notes</span>
              <textarea
                value={editIntent.notes}
                onChange={(event) =>
                  setEditIntent((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                placeholder="Extra operator context for this intent."
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSubmitting}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-muted">Short name</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {savedShortName || 'Not set.'}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-muted">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">{savedNotes || 'Not set.'}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">Skills</div>
            <div className="flex flex-wrap gap-2">
              {savedSkills.length === 0 ? (
                <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                  No skills selected
                </span>
              ) : (
                savedSkills.map((skillId) => (
                  <span
                    key={skillId}
                    className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-foreground"
                  >
                    {skillId}
                    <span className="ml-1 text-muted">
                      {fallbackSkillTitleById.get(skillId)
                        ? `- ${fallbackSkillTitleById.get(skillId)}`
                        : ''}
                    </span>
                  </span>
                ))
              )}
            </div>

            <details className="rounded-lg border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">Selected skill SOPs</summary>
              <div className="mt-2 space-y-2">
                {selectedSkillDetails.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                    Select skills to view SOP context.
                  </div>
                ) : (
                  selectedSkillDetails.map((skill) => (
                    <details key={skill.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">
                        {skill.id} - {skill.title}
                      </summary>
                      <div className="mt-2 space-y-2 text-xs text-muted">
                        <div>tags: {skill.tags.length > 0 ? skill.tags.join(', ') : '-'}</div>
                        <div>
                          applies_to: {skill.applies_to.length > 0 ? skill.applies_to.join(', ') : '-'}
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-xs text-foreground">
                          {skill.content_md || 'No resolved SOP content.'}
                        </pre>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </details>

            <details className="rounded-lg border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">Browse skills library</summary>
              <div className="mt-2 space-y-2">
                {resolvedSkillLibrary.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                    No skill definitions found in docs/skills/library.
                  </div>
                ) : (
                  resolvedSkillLibrary.map((skill) => (
                    <details key={skill.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">
                        {skill.id} - {skill.title}
                      </summary>
                      <div className="mt-2 space-y-2 text-xs text-muted">
                        <div>tags: {skill.tags.length > 0 ? skill.tags.join(', ') : '-'}</div>
                        <div>
                          applies_to: {skill.applies_to.length > 0 ? skill.applies_to.join(', ') : '-'}
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-xs text-foreground">
                          {skill.content_md || 'No skill content.'}
                        </pre>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </details>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">Intent</div>
            {hasVisibleIntent ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-foreground">
                <div>
                  <span className="font-semibold">Summary:</span>{' '}
                  <span className="whitespace-pre-wrap">{currentIntentUi.summary || 'Not set.'}</span>
                </div>
                <div>
                  <div className="font-semibold">Constraints:</div>
                  {currentIntentUi.constraints ? (
                    <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
                      {currentIntentUi.constraints.split(/\r?\n/).map((line, index) => (
                        <li key={`${line}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-muted">Not set.</div>
                  )}
                </div>
                <div>
                  <div className="font-semibold">Avoid:</div>
                  {currentIntentUi.avoid ? (
                    <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
                      {currentIntentUi.avoid.split(/\r?\n/).map((line, index) => (
                        <li key={`${line}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-muted">Not set.</div>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Notes:</span>{' '}
                  <span className="whitespace-pre-wrap">{currentIntentUi.notes || 'Not set.'}</span>
                </div>

                {intentAdvancedEntries.length > 0 ? (
                  <details className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
                      Other intent fields (advanced)
                    </summary>
                    <div className="mt-2 space-y-2 text-xs text-muted">
                      {intentAdvancedEntries.map((entry) => (
                        <div key={entry.key} className="rounded border border-border bg-surface px-2 py-1">
                          <div className="font-semibold text-foreground">{entry.key}</div>
                          <div className="mt-1 whitespace-pre-wrap">{formatIntentValue(entry.value)}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                No intent set yet. Click Edit to add summary, constraints, avoid list, and notes.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <details className="rounded-lg border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Prompt to ask AI to write/update intent
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => copyPrompt(intentPromptText, intentPromptRef)}
                    className="rounded-md border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  ref={intentPromptRef}
                  readOnly
                  value={intentPromptText}
                  rows={12}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
            </details>

            <details className="rounded-lg border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Prompt to ask AI to draft a new Skill markdown file
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => copyPrompt(skillDraftPromptText, skillPromptRef)}
                    className="rounded-md border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  ref={skillPromptRef}
                  readOnly
                  value={skillDraftPromptText}
                  rows={12}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
