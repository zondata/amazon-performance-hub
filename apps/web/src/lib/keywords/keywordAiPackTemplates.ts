import 'server-only';

import { getPageSettings } from '@/lib/uiSettings/getPageSettings';
import { savePageSettings } from '@/lib/uiSettings/savePageSettings';

import {
  normalizeKeywordAiPackTemplates,
  type KeywordAiPackTemplate,
} from './keywordAiPackTemplatesModel';

export const PAGE_KEY = 'keywords.ai_pack_templates';

type KeywordAiPackTemplatesContext = {
  accountId: string;
  marketplace: string;
};

export const getKeywordAiPackTemplates = async ({
  accountId,
  marketplace,
}: KeywordAiPackTemplatesContext): Promise<KeywordAiPackTemplate[]> => {
  const settings = await getPageSettings({
    accountId,
    marketplace,
    pageKey: PAGE_KEY,
  });

  return normalizeKeywordAiPackTemplates(settings);
};

export const saveKeywordAiPackTemplates = async ({
  accountId,
  marketplace,
  templates,
}: KeywordAiPackTemplatesContext & {
  templates: KeywordAiPackTemplate[];
}): Promise<void> => {
  const normalized = normalizeKeywordAiPackTemplates({ templates });

  await savePageSettings({
    accountId,
    marketplace,
    pageKey: PAGE_KEY,
    settings: { templates: normalized },
  });
};
