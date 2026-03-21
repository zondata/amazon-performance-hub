'use client';

export type TargetExpandedTabKey =
  | 'why_flagged'
  | 'change_plan'
  | 'search_term'
  | 'placement'
  | 'sqp'
  | 'metrics'
  | 'advanced';

type TargetExpandedTabDefinition = {
  key: TargetExpandedTabKey;
  label: string;
};

type TargetExpandedTabsProps = {
  targetSnapshotId: string;
  activeKey: TargetExpandedTabKey;
  onChange: (nextKey: TargetExpandedTabKey) => void;
};

export const TARGET_EXPANDED_TAB_DEFINITIONS: TargetExpandedTabDefinition[] = [
  { key: 'why_flagged', label: 'Why flagged' },
  { key: 'change_plan', label: 'Change plan' },
  { key: 'search_term', label: 'Search term' },
  { key: 'placement', label: 'Placement' },
  { key: 'sqp', label: 'SQP' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'advanced', label: 'Advanced' },
];

export const getTargetExpandedTabId = (
  targetSnapshotId: string,
  tabKey: TargetExpandedTabKey
) => `target-expanded-tab-${targetSnapshotId}-${tabKey}`;

export const getTargetExpandedTabPanelId = (
  targetSnapshotId: string,
  tabKey: TargetExpandedTabKey
) => `target-expanded-tabpanel-${targetSnapshotId}-${tabKey}`;

export default function TargetExpandedTabs(props: TargetExpandedTabsProps) {
  return (
    <div className="overflow-x-auto">
      <div
        role="tablist"
        aria-label="Expanded target details"
        className="flex min-w-max items-center px-2"
      >
        {TARGET_EXPANDED_TAB_DEFINITIONS.map((tab) => {
          const isActive = tab.key === props.activeKey;

          return (
            <button
              key={tab.key}
              id={getTargetExpandedTabId(props.targetSnapshotId, tab.key)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={getTargetExpandedTabPanelId(props.targetSnapshotId, tab.key)}
              onClick={() => props.onChange(tab.key)}
              className={`border-b-2 px-[14px] py-2 text-[12px] whitespace-nowrap transition ${
                isActive
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
