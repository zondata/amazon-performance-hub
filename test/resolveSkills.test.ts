import { describe, expect, it } from 'vitest';

import { resolveSkillsByIds } from '../apps/web/src/lib/skills/resolveSkills';

describe('resolveSkillsByIds', () => {
  it('resolves known skills from docs/skills/library', () => {
    const [skill] = resolveSkillsByIds(['unit_economics_first']);

    expect(skill).toMatchObject({
      id: 'unit_economics_first',
      title: 'Unit Economics First',
      version: '1.0.0',
    });
    expect(skill.tags.length).toBeGreaterThan(0);
    expect(skill.content_md).toContain('SOP');
  });

  it('returns placeholder for unknown skill ids', () => {
    const [skill] = resolveSkillsByIds(['unknown_skill_id']);

    expect(skill).toEqual({
      id: 'unknown_skill_id',
      title: '(missing skill)',
      version: '0.0.0',
      tags: [],
      applies_to: [],
      content_md: '',
    });
  });

  it('dedupes ids and preserves first-seen order', () => {
    const resolved = resolveSkillsByIds([
      'placement_modifier_review',
      'placement_modifier_review',
      'unit_economics_first',
    ]);

    expect(resolved.map((entry) => entry.id)).toEqual([
      'placement_modifier_review',
      'unit_economics_first',
    ]);
  });
});
