'use server';

import { env } from '@/lib/env';
import { saveKeywordAiPackTemplates } from '@/lib/keywords/keywordAiPackTemplates';
import type { KeywordAiPackTemplate } from '@/lib/keywords/keywordAiPackTemplatesModel';

export const saveKeywordAiPackTemplatesAction = async (
  templates: KeywordAiPackTemplate[]
) => {
  await saveKeywordAiPackTemplates({
    accountId: env.accountId,
    marketplace: env.marketplace,
    templates,
  });

  return { ok: true };
};
