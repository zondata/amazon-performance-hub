export const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .replace(/_+/g, '_')
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : 'keyword_set';
};

type BuildKeywordAiPackFilenameInput = {
  asin: string;
  setName?: string | null;
  templateId?: string | null;
};

export const buildKeywordAiPackFilename = ({
  asin,
  setName,
  templateId,
}: BuildKeywordAiPackFilenameInput): string => {
  const asinPart = asin.trim().toUpperCase();
  const setNamePart =
    typeof setName === 'string' && setName.trim().length > 0
      ? `_${sanitizeFileSegment(setName)}`
      : '';
  const templateIdTrimmed = typeof templateId === 'string' ? templateId.trim() : '';
  const templatePart =
    templateIdTrimmed && templateIdTrimmed !== 'formatting_only'
      ? `_tmpl_${sanitizeFileSegment(templateIdTrimmed)}`
      : '';

  return `${asinPart}${setNamePart}_keyword_ai_pack${templatePart}.md`;
};
