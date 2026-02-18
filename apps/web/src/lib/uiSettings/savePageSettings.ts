import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type SavePageSettingsInput = {
  accountId: string;
  marketplace: string;
  pageKey: string;
  settings: Record<string, unknown>;
};

export const savePageSettings = async ({
  accountId,
  marketplace,
  pageKey,
  settings,
}: SavePageSettingsInput) => {
  const payload = {
    account_id: accountId,
    marketplace,
    page_key: pageKey,
    settings,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('ui_page_settings')
    .upsert(payload, { onConflict: 'account_id,marketplace,page_key' });

  if (error) {
    throw new Error(`Failed to save page settings: ${error.message}`);
  }
};
