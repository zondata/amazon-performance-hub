type TabItem = {
  label: string;
  value: string;
  href: string;
};

type TabsProps = {
  items: TabItem[];
  current: string;
};

export default function Tabs({ items, current }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {items.map((item) => {
        const active = item.value === current;
        return (
          <a
            key={item.value}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
