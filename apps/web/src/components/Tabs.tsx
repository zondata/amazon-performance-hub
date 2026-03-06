type TabItem = {
  label: string;
  value: string;
  href: string;
  disabled?: boolean;
  title?: string;
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
        if (item.disabled) {
          return (
            <span
              key={item.value}
              title={item.title}
              aria-disabled="true"
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted/70 opacity-70"
            >
              {item.label}
            </span>
          );
        }
        return (
          <a
            key={item.value}
            href={item.href}
            title={item.title}
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
