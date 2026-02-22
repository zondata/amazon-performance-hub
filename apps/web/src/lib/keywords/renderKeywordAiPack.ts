type RenderKeywordAiPackInput = {
  asin: string;
  title: string | null;
  short_name: string | null;
  group_set?: {
    name: string;
    is_exclusive: boolean;
    created_at: string | null;
  } | null;
  allowed_group_names?: string[] | null;
  template: {
    name: string;
    instructions_md: string;
  };
};

const displayOrDash = (value: string | null | undefined): string =>
  value && value.trim().length > 0 ? value : '—';

export const renderKeywordAiPackMarkdown = (
  input: RenderKeywordAiPackInput
): string => {
  const asin = input.asin.trim().toUpperCase();
  const lines: string[] = [];

  lines.push('# Keyword AI Pack');
  lines.push('');
  lines.push('## Product');
  lines.push(`- ASIN: ${asin}`);
  lines.push(`- Title: ${displayOrDash(input.title)}`);
  lines.push(`- Short name: ${displayOrDash(input.short_name)}`);
  lines.push('');

  if (input.group_set) {
    lines.push('## Group Set');
    lines.push(`- Name: ${input.group_set.name}`);
    lines.push(`- Exclusive: ${input.group_set.is_exclusive ? 'Yes' : 'No'}`);
    lines.push(`- Created: ${displayOrDash(input.group_set.created_at)}`);
    lines.push('');
  }

  if (Array.isArray(input.allowed_group_names)) {
    lines.push('## Allowed Group Names (Columns D-O)');
    if (input.allowed_group_names.length > 0) {
      input.allowed_group_names.forEach((name) => lines.push(`- ${name}`));
    } else {
      lines.push('- (none)');
    }
    lines.push('');
  }

  lines.push('## Assistant Instructions');
  if (input.template.instructions_md.length > 0) {
    lines.push(input.template.instructions_md);
  }
  lines.push('');

  lines.push('## Exact CSV Requirements');
  lines.push('- Row 1 is headers (no notes row). Columns must be:');
  lines.push('  - A: keyword');
  lines.push('  - B: group');
  lines.push('  - C: note');
  lines.push('  - D..O: group columns (max 12 groups).');
  if (Array.isArray(input.allowed_group_names)) {
    lines.push('- Only the allowed group names listed above are valid for columns D..O.');
  } else {
    lines.push('- Use your chosen group names in columns D..O.');
  }
  lines.push('- Keywords are normalized (lowercase, trim, collapse spaces).');
  lines.push('- Duplicate keywords are deduplicated automatically by normalized value.');
  lines.push(
    '- Exclusive rule: when Exclusive mode is enabled, each keyword can belong to only one group.'
  );
  lines.push('- Output only a CSV in this exact format.');
  lines.push('');

  lines.push('## Ask');
  lines.push('Please produce a CSV that follows the exact format above.');
  lines.push('');

  return lines.join('\n');
};
