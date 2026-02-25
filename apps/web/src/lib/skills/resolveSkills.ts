import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

export type ResolvedSkill = {
  id: string;
  title: string;
  version: string;
  tags: string[];
  applies_to: string[];
  content_md: string;
};

type ParsedFrontmatter = Record<string, string | string[]>;

const MISSING_TITLE = '(missing skill)';

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const stripQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const parseInlineList = (value: string): string[] => {
  const text = value.trim();
  if (!text.startsWith('[') || !text.endsWith(']')) {
    return [];
  }
  const inner = text.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map((entry) => stripQuotes(entry))
    .filter((entry) => entry.length > 0);
};

const parseFrontmatter = (rawFrontmatter: string): ParsedFrontmatter => {
  const rows = rawFrontmatter.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parsed: ParsedFrontmatter = {};

  for (let index = 0; index < rows.length; index += 1) {
    const line = rows[index];
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) continue;

    const key = keyMatch[1];
    const rawValue = keyMatch[2] ?? '';
    if (rawValue.trim().length > 0) {
      const inlineList = parseInlineList(rawValue);
      parsed[key] = inlineList.length > 0 ? inlineList : stripQuotes(rawValue);
      continue;
    }

    const listValues: string[] = [];
    while (index + 1 < rows.length) {
      const candidate = rows[index + 1];
      const itemMatch = candidate.match(/^\s*-\s*(.+)$/);
      if (!itemMatch) break;
      listValues.push(stripQuotes(itemMatch[1]));
      index += 1;
    }
    parsed[key] = listValues;
  }

  return parsed;
};

const toStringArray = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) {
    const dedup = new Set<string>();
    for (const item of value) {
      const normalized = asString(item);
      if (!normalized) continue;
      dedup.add(normalized);
    }
    return [...dedup];
  }

  const parsed = asString(value);
  if (!parsed) return [];
  const inlineList = parseInlineList(parsed);
  return inlineList.length > 0 ? inlineList : [parsed];
};

const toMissingSkill = (id: string): ResolvedSkill => ({
  id,
  title: MISSING_TITLE,
  version: '0.0.0',
  tags: [],
  applies_to: [],
  content_md: '',
});

const parseSkillFile = (filePath: string): ResolvedSkill | null => {
  const source = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = parseFrontmatter(match[1]);
  const fallbackId = path.basename(filePath).replace(/\.md$/i, '').trim();
  const id = asString(frontmatter.id) ?? fallbackId;
  if (!id) return null;

  return {
    id,
    title: asString(frontmatter.title) ?? MISSING_TITLE,
    version: asString(frontmatter.version) ?? '0.0.0',
    tags: toStringArray(frontmatter.tags),
    applies_to: toStringArray(frontmatter.applies_to),
    content_md: match[2].trim(),
  };
};

const resolveLibraryDir = (): string | null => {
  const candidates = [
    path.resolve(process.cwd(), 'docs/skills/library'),
    path.resolve(process.cwd(), '../docs/skills/library'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
};

let cachedSkillLibrary: Map<string, ResolvedSkill> | null = null;

const loadSkillLibrary = (): Map<string, ResolvedSkill> => {
  if (cachedSkillLibrary) {
    return cachedSkillLibrary;
  }

  const library = new Map<string, ResolvedSkill>();
  const libraryDir = resolveLibraryDir();
  if (!libraryDir) {
    cachedSkillLibrary = library;
    return library;
  }

  const files = fs
    .readdirSync(libraryDir)
    .filter((entry) => /\.md$/i.test(entry))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of files) {
    const fullPath = path.join(libraryDir, fileName);
    const resolved = parseSkillFile(fullPath);
    if (!resolved || library.has(resolved.id)) continue;
    library.set(resolved.id, resolved);
  }

  cachedSkillLibrary = library;
  return library;
};

const normalizeSkillIds = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const idRaw of ids) {
    const id = asString(idRaw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
};

export const isMissingSkill = (skill: ResolvedSkill): boolean =>
  skill.title === MISSING_TITLE && skill.version === '0.0.0';

export const listResolvedSkills = (): ResolvedSkill[] =>
  Array.from(loadSkillLibrary().values()).sort((left, right) => left.id.localeCompare(right.id));

export const resolveSkillsByIds = (ids: string[]): ResolvedSkill[] => {
  const skillLibrary = loadSkillLibrary();
  const normalizedIds = normalizeSkillIds(ids);

  return normalizedIds.map((id) => skillLibrary.get(id) ?? toMissingSkill(id));
};
