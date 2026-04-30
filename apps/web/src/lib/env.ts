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
  enableAdsOptimizer: process.env.ENABLE_ADS_OPTIMIZER === '1',
  enableSpendReconciliation: process.env.ENABLE_SPEND_RECONCILIATION === '1',
  bulkgenOutRoot: process.env.BULKGEN_OUT_ROOT,
  bulkgenPendingDir: process.env.BULKGEN_PENDING_RECONCILE_DIR,
  bulkgenReconciledDir: process.env.BULKGEN_RECONCILED_DIR,
  bulkgenFailedDir: process.env.BULKGEN_FAILED_DIR,
  bulkgenTemplateSpUpdate: process.env.BULKGEN_TEMPLATE_SP_UPDATE,
  bulkgenTemplateSbUpdate: process.env.BULKGEN_TEMPLATE_SB_UPDATE,
  bulkgenTemplateSpCreate: process.env.BULKGEN_TEMPLATE_SP_CREATE,
  bulkgenTemplateBucket: process.env.BULKGEN_TEMPLATE_BUCKET?.trim() || 'bulkgen-templates',
  enableBulkgenSpawn: process.env.ENABLE_BULKGEN_SPAWN === '1',
  githubActionsDispatchToken: process.env.GITHUB_ACTIONS_DISPATCH_TOKEN?.trim(),
  githubActionsRepoOwner: process.env.GITHUB_ACTIONS_REPO_OWNER?.trim(),
  githubActionsRepoName: process.env.GITHUB_ACTIONS_REPO_NAME?.trim(),
  githubActionsWorkflowFile:
    process.env.GITHUB_ACTIONS_WORKFLOW_FILE?.trim() || 'v3-amazon-data-sync.yml',
  githubActionsWorkflowRef:
    process.env.GITHUB_ACTIONS_WORKFLOW_REF?.trim() ||
    process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
    'main',
};
