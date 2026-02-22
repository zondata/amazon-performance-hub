import KeywordAiPackTemplateEditor from '@/components/KeywordAiPackTemplateEditor';
import { env } from '@/lib/env';
import { getKeywordAiPackTemplates } from '@/lib/keywords/keywordAiPackTemplates';

export const dynamic = 'force-dynamic';

export default async function KeywordAiPackSettingsPage() {
  const templates = await getKeywordAiPackTemplates({
    accountId: env.accountId,
    marketplace: env.marketplace,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Settings</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Keyword AI Pack Templates
        </h1>
        <p className="mt-2 text-sm text-muted">
          Manage multiple Keyword AI pack templates, edit instructions, and choose one
          default template.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <KeywordAiPackTemplateEditor initialTemplates={templates} />
      </section>
    </div>
  );
}
