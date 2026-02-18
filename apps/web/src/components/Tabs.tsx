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
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      {items.map((item) => {
        const active = item.value === current;
        return (
          <a
            key={item.value}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-2 text-muted hover:bg-surface-2/80'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
