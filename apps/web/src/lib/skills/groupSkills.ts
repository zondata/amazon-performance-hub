export type SkillLike = {
  id: string;
  title: string;
  applies_to: string[];
  tags: string[];
};

type SkillStage = 'analysis' | 'planning' | 'execution' | 'evaluation' | 'other';

const STAGE_ORDER: SkillStage[] = ['analysis', 'planning', 'execution', 'evaluation', 'other'];

const STAGE_LABELS: Record<SkillStage, string> = {
  analysis: 'Analysis',
  planning: 'Planning',
  execution: 'Execution',
  evaluation: 'Evaluation',
  other: 'Other',
};

const getPrimaryStage = (skill: SkillLike): SkillStage => {
  for (const stage of STAGE_ORDER) {
    if (stage === 'other') break;
    if (skill.applies_to.includes(stage)) {
      return stage;
    }
  }
  return 'other';
};

export function groupSkillsByPrimaryStage(
  skills: SkillLike[]
): Array<{ key: string; label: string; skills: SkillLike[] }> {
  const byStage = new Map<SkillStage, SkillLike[]>();

  for (const skill of skills) {
    const stage = getPrimaryStage(skill);
    const bucket = byStage.get(stage);
    if (bucket) {
      bucket.push(skill);
    } else {
      byStage.set(stage, [skill]);
    }
  }

  const groups: Array<{ key: string; label: string; skills: SkillLike[] }> = [];

  for (const stage of STAGE_ORDER) {
    const bucket = byStage.get(stage);
    if (!bucket || bucket.length === 0) continue;
    bucket.sort((left, right) => left.id.localeCompare(right.id));
    groups.push({
      key: stage,
      label: STAGE_LABELS[stage],
      skills: bucket,
    });
  }

  return groups;
}
