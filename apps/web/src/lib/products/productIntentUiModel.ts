export type IntentUi = {
  summary: string;
  constraints: string;
  avoid: string;
  notes: string;
};

const asString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
};

const linesToArray = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export function intentToUi(intent: Record<string, unknown> | null): IntentUi {
  if (!intent) {
    return {
      summary: '',
      constraints: '',
      avoid: '',
      notes: '',
    };
  }

  const summary =
    asString(intent.summary) || asString(intent.goal) || asString(intent.text) || '';

  const constraints = asStringArray(intent.constraints).join('\n');

  const avoidValues = asStringArray(intent.avoid);
  const avoidFallback = avoidValues.length > 0 ? avoidValues : asStringArray(intent.do_not);

  return {
    summary,
    constraints,
    avoid: avoidFallback.join('\n'),
    notes: asString(intent.notes),
  };
}

export function uiToIntent(
  ui: IntentUi,
  baseIntent: Record<string, unknown> | null
): Record<string, unknown> | null {
  const next: Record<string, unknown> = {
    ...(baseIntent ?? {}),
  };

  const summary = ui.summary.trim();
  if (summary) {
    next.summary = summary;
  } else {
    delete next.summary;
  }

  const constraints = linesToArray(ui.constraints);
  if (constraints.length > 0) {
    next.constraints = constraints;
  } else {
    delete next.constraints;
  }

  const avoid = linesToArray(ui.avoid);
  if (avoid.length > 0) {
    next.avoid = avoid;
  } else {
    delete next.avoid;
  }

  const notes = ui.notes.trim();
  if (notes) {
    next.notes = notes;
  } else {
    delete next.notes;
  }

  return Object.keys(next).length > 0 ? next : null;
}
