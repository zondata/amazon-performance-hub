import 'server-only';

import { getPageSettings } from '@/lib/uiSettings/getPageSettings';
import { savePageSettings } from '@/lib/uiSettings/savePageSettings';

import {
  normalizeProductExperimentPromptTemplates,
  type ProductExperimentPromptTemplate,
} from './productExperimentPromptTemplatesModel';

export const PAGE_KEY = 'logbook.product_experiment_prompt_templates';

type ProductExperimentPromptTemplatesContext = {
  accountId: string;
  marketplace: string;
};

export const getProductExperimentPromptTemplates = async ({
  accountId,
  marketplace,
}: ProductExperimentPromptTemplatesContext): Promise<ProductExperimentPromptTemplate[]> => {
  const settings = await getPageSettings({
    accountId,
    marketplace,
    pageKey: PAGE_KEY,
  });

  return normalizeProductExperimentPromptTemplates(settings);
};

export const saveProductExperimentPromptTemplates = async ({
  accountId,
  marketplace,
  templates,
}: ProductExperimentPromptTemplatesContext & {
  templates: ProductExperimentPromptTemplate[];
}): Promise<void> => {
  const normalized = normalizeProductExperimentPromptTemplates({ templates });

  await savePageSettings({
    accountId,
    marketplace,
    pageKey: PAGE_KEY,
    settings: { templates: normalized },
  });
};
