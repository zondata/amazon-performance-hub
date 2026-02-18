import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type GetPageSettingsInput = {
  accountId: string;
  marketplace: string;
  pageKey: string;
};

export const getPageSettings = async ({
  accountId,
  marketplace,
  pageKey,
}: GetPageSettingsInput) => {
  const { data, error } = await supabaseAdmin
    .from('ui_page_settings')
    .select('settings')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('page_key', pageKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load page settings: ${error.message}`);
  }

  return data?.settings ?? null;
};
