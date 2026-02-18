import BulksheetOpsTabs from '@/components/BulksheetOpsTabs';
import PageHeader from '@/components/PageHeader';

export default function BulksheetOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulksheet Ops"
        subtitle="Generate bulksheet updates and reconcile creates from local files."
      />
      <BulksheetOpsTabs />
      {children}
    </div>
  );
}
