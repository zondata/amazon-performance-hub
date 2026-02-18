'use server';

import { env } from '@/lib/env';
import { savePageSettings } from '@/lib/uiSettings/savePageSettings';

type SalesTrendSettingsPayload = {
  enabledMetrics: string[];
  cardSlots: string[];
};

export const saveSalesTrendSettings = async (settings: SalesTrendSettingsPayload) => {
  await savePageSettings({
    accountId: env.accountId,
    marketplace: env.marketplace,
    pageKey: 'sales.trend',
    settings,
  });

  return { ok: true };
};
