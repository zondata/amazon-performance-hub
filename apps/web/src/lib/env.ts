import 'server-only';

type EnvValue = string | undefined;

const requireEnv = (key: string, value: EnvValue): string => {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  supabaseUrl: requireEnv('SUPABASE_URL', process.env.SUPABASE_URL),
  supabaseServiceRoleKey: requireEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ),
  accountId: requireEnv('APP_ACCOUNT_ID', process.env.APP_ACCOUNT_ID),
  marketplace: requireEnv('APP_MARKETPLACE', process.env.APP_MARKETPLACE),
  pendingReconcileDir: process.env.PENDING_RECONCILE_DIR,
  enableSpendReconciliation: process.env.ENABLE_SPEND_RECONCILIATION === '1',
  bulkgenOutRoot: process.env.BULKGEN_OUT_ROOT,
  bulkgenPendingDir: process.env.BULKGEN_PENDING_RECONCILE_DIR,
  bulkgenReconciledDir: process.env.BULKGEN_RECONCILED_DIR,
  bulkgenFailedDir: process.env.BULKGEN_FAILED_DIR,
  bulkgenTemplateSpUpdate: process.env.BULKGEN_TEMPLATE_SP_UPDATE,
  bulkgenTemplateSbUpdate: process.env.BULKGEN_TEMPLATE_SB_UPDATE,
  bulkgenTemplateSpCreate: process.env.BULKGEN_TEMPLATE_SP_CREATE,
  enableBulkgenSpawn: process.env.ENABLE_BULKGEN_SPAWN === '1',
};
