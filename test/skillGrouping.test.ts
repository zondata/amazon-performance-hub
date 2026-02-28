import { describe, expect, it } from 'vitest';

import { groupSkillsByPrimaryStage, type SkillLike } from '../apps/web/src/lib/skills/groupSkills';

describe('groupSkillsByPrimaryStage', () => {
  it('uses deterministic group order and sorts skill ids within each group', () => {
    const skills: SkillLike[] = [
      { id: 'z_eval', title: 'Eval Z', applies_to: ['evaluation'], tags: [] },
      { id: 'b_analysis', title: 'Analysis B', applies_to: ['analysis'], tags: [] },
      { id: 'a_analysis', title: 'Analysis A', applies_to: ['analysis'], tags: [] },
      { id: 'c_exec', title: 'Exec C', applies_to: ['execution'], tags: [] },
    ];

    const grouped = groupSkillsByPrimaryStage(skills);

    expect(grouped.map((group) => group.key)).toEqual(['analysis', 'execution', 'evaluation']);
    expect(grouped[0]?.skills.map((skill) => skill.id)).toEqual(['a_analysis', 'b_analysis']);
  });

  it('assigns skills to the earliest applicable stage', () => {
    const skills: SkillLike[] = [
      {
        id: 'multi_stage',
        title: 'Multi Stage',
        applies_to: ['evaluation', 'planning', 'execution'],
        tags: [],
      },
    ];

    const grouped = groupSkillsByPrimaryStage(skills);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.key).toBe('planning');
    expect(grouped[0]?.skills[0]?.id).toBe('multi_stage');
  });

  it('puts skills without known stages into other', () => {
    const skills: SkillLike[] = [
      {
        id: 'custom_stage',
        title: 'Custom Stage',
        applies_to: ['custom', 'postmortem'],
        tags: ['ops'],
      },
    ];

    const grouped = groupSkillsByPrimaryStage(skills);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.key).toBe('other');
    expect(grouped[0]?.skills.map((skill) => skill.id)).toEqual(['custom_stage']);
  });
});
