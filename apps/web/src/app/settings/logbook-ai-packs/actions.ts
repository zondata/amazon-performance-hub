'use server';

import { env } from '@/lib/env';
import { saveProductExperimentPromptTemplates } from '@/lib/logbook/productExperimentPromptTemplates';
import type { ProductExperimentPromptTemplate } from '@/lib/logbook/productExperimentPromptTemplatesModel';

export const saveProductExperimentPromptTemplatesAction = async (
  templates: ProductExperimentPromptTemplate[]
) => {
  await saveProductExperimentPromptTemplates({
    accountId: env.accountId,
    marketplace: env.marketplace,
    templates,
  });

  return { ok: true };
};
