import ProductExperimentPromptTemplateEditor from '@/components/logbook/ProductExperimentPromptTemplateEditor';
import { env } from '@/lib/env';
import { getProductExperimentPromptTemplates } from '@/lib/logbook/productExperimentPromptTemplates';

export const dynamic = 'force-dynamic';

export default async function LogbookAiPacksSettingsPage() {
  const templates = await getProductExperimentPromptTemplates({
    accountId: env.accountId,
    marketplace: env.marketplace,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Settings</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Product Logbook Prompt Pack Templates
        </h1>
        <p className="mt-2 text-sm text-muted">
          Manage Product Logbook prompt templates, edit assistant instructions, and set
          a default template.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <ProductExperimentPromptTemplateEditor initialTemplates={templates} />
      </section>
    </div>
  );
}
