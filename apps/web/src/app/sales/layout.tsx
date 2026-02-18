import SalesTabs from '@/components/SalesTabs';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Sales Center
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sales</h1>
        <p className="mt-1 text-sm text-slate-500">
          Daily and monthly performance from Scale Insights exports.
        </p>
      </div>
      <SalesTabs />
      {children}
    </div>
  );
}
