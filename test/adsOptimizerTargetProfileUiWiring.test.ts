import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx'
);
const shellPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsPageShell.tsx'
);
const toolbarPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsToolbar.tsx'
);
const summaryRowPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetSummaryRow.tsx'
);
const expandedPanelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetExpandedPanel.tsx'
);
const expandedTabsPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetExpandedTabs.tsx'
);
const overrideFormPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetOverrideForm.tsx'
);
const runtimePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/runtime.ts'
);
const tableLayoutPrefsPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/targetTableLayoutPrefs.ts'
);

describe('ads optimizer phase 6 inline target review wiring', () => {
  it('loads targets view data only for the targets view and renders the inline targets panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain(
      "view === 'targets' && utility === null && (asin !== 'all' || requestedRunId !== null)"
    );
    expect(source).toContain('getAdsOptimizerTargetsViewData');
    expect(source).toContain('<OptimizerTargetsPanel');
    expect(source).toContain('Inline target review');
    expect(source).toContain('handoffAdsOptimizerToWorkspaceAction');
    expect(source).toContain('saveAdsOptimizerRecommendationOverrideAction');
    expect(source).toContain("paramValue('override_error') === '1'");
    expect(source).toContain('runId: requestedRunId');
  });

  it('keeps the stable wrapper but switches the default review path to inline row expansion', () => {
    const wrapperSource = fs.readFileSync(panelPath, 'utf-8');
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const toolbarSource = fs.readFileSync(toolbarPath, 'utf-8');
    const summaryRowSource = fs.readFileSync(summaryRowPath, 'utf-8');
    const expandedPanelSource = fs.readFileSync(expandedPanelPath, 'utf-8');
    const expandedTabsSource = fs.readFileSync(expandedTabsPath, 'utf-8');
    const overrideFormSource = fs.readFileSync(overrideFormPath, 'utf-8');

    expect(wrapperSource).toContain('TargetsPageShell');
    expect(shellSource).toContain('buildAdsOptimizerTargetRowTableSummaries');
    expect(shellSource).toContain('filterAdsOptimizerTargetRowTableSummaries');
    expect(shellSource).toContain('<TargetsToolbar');
    expect(shellSource).toContain('<TargetSummaryRow');
    expect(shellSource).toContain('<TargetExpandedPanel');
    expect(shellSource).toContain('<TargetExpandedTabs');
    expect(shellSource).toContain('Targets review');
    expect(shellSource).toContain('buildWhyFlaggedNarrative');
    expect(shellSource).toContain("useState<TargetExpandedTabKey>('why_flagged')");
    expect(shellSource).toContain("setActiveExpandedTab('why_flagged');");
    expect(shellSource).toContain('expandedContent={');
    expect(shellSource).toContain('colSpan={7}');
    expect(shellSource).toContain('data-aph-hscroll');
    expect(shellSource).toContain('overflow-x-auto overflow-y-visible');
    expect(shellSource).toContain('min-w-full table-fixed');
    expect(shellSource).toContain('<colgroup>');
    expect(shellSource).toContain('<thead>');
    expect(shellSource).toContain('<tbody>');
    expect(shellSource).not.toContain('No target rows match the current inline review filters.');
    expect(shellSource).toContain('ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY');
    expect(shellSource).toContain('window.localStorage.getItem');
    expect(shellSource).toContain('window.localStorage.setItem');
    expect(shellSource).toContain('parseAdsOptimizerTargetTableLayoutPrefs');
    expect(shellSource).toContain('serializeAdsOptimizerTargetTableLayoutPrefs');
    expect(shellSource).toContain('applyAdsOptimizerTargetTableColumnResizeDelta');
    expect(shellSource).toContain('toggleAdsOptimizerTargetTableFrozenColumn');
    expect(shellSource).toContain('activeColumnResize');
    expect(shellSource).toContain("window.addEventListener('pointermove'");
    expect(shellSource).toContain("window.addEventListener('pointerup'");
    expect(shellSource).toContain("window.addEventListener('pointercancel'");
    expect(shellSource).toContain('handleColumnResizePointerDown');
    expect(shellSource).toContain('data-column-resize-handle');
    expect(shellSource).toContain("tableLayoutPrefs.frozenColumns.includes('target')");
    expect(shellSource).toContain('sticky left-0 z-30');
    expect(shellSource).toContain('Search targets');
    expect(shellSource).toContain('aria-label="Search target rows"');
    expect(shellSource).toContain('No matching targets');
    expect(shellSource).toContain('Try a different search or clear filters.');
    expect(shellSource).toContain('Clear search');
    expect(shellSource).toContain('colSpan={ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.length}');
    expect(shellSource).toContain("onClick={() => setTargetSearch('')}");
    expect(shellSource).toContain('P&L (current)');
    expect(shellSource).toContain('ACoS (current)');
    expect(shellSource).toContain('Spend (current)');
    expect(shellSource).toContain('Sales (current)');
    expect(shellSource).toContain('Orders (current)');
    expect(shellSource).toContain('Sales rank');
    expect(shellSource).toContain('Spend rank');
    expect(shellSource).toContain('Impression rank');
    expect(shellSource).toContain('Organic rank');
    expect(shellSource).toContain('Organic trend');
    expect(shellSource).toContain('toggleExpandedTargetSnapshotId');
    expect(shellSource).toContain('resolveVisibleExpandedTargetSnapshotId');
    expect(shellSource).not.toContain('Target queue');
    expect(shellSource).not.toContain('Use the drawer');
    const tableLayoutPrefsSource = fs.readFileSync(tableLayoutPrefsPath, 'utf-8');
    const orderedHeaders = [
      "label: 'Target'",
      "label: 'State'",
      "label: 'Economics'",
      "label: 'Contribution'",
      "label: 'Ranking'",
      "label: 'Role'",
      "label: 'Change summary'",
    ];
    const orderedIndexes = orderedHeaders.map((label) => tableLayoutPrefsSource.indexOf(label));
    orderedIndexes.forEach((index, position) => {
      expect(index, `missing header ${orderedHeaders[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < orderedIndexes.length; index += 1) {
      expect(orderedIndexes[index]).toBeGreaterThan(orderedIndexes[index - 1]!);
    }
    expect(summaryRowSource).toContain('data-persisted-target-key');
    expect(summaryRowSource).toContain('aria-expanded={props.isActive}');
    expect(summaryRowSource).toContain('aria-controls=');
    expect(summaryRowSource).toContain('Select ${row.targetText} for Ads Workspace handoff');
    expect(summaryRowSource).toContain('Chevron expanded={props.isActive}');
    expect(summaryRowSource).toContain('sticky left-0 z-20');
    expect(summaryRowSource).toContain('summary.stateComparison.rows[0]');
    expect(summaryRowSource).toContain('summary.stateComparison.rows.slice(1)');
    expect(summaryRowSource).toContain('stateStatus.current.display');
    expect(summaryRowSource).toContain('stateStatusClass');
    expect(summaryRowSource).toContain("columnStyle('target')");
    expect(summaryRowSource).toContain('maxWidth');
    expect(summaryRowSource).toContain('w-full min-w-0 max-w-full');
    expect(summaryRowSource).toContain('overflow-hidden');
    expect(summaryRowSource).toContain(
      'grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,1fr))]'
    );
    expect(summaryRowSource).not.toContain(
      'grid w-max grid-cols-[max-content_repeat(3,minmax(6.5rem,max-content))]'
    );
    expect(summaryRowSource).not.toContain('className="px-3 py-3 align-top whitespace-nowrap"');
    expect(summaryRowSource).not.toContain('min-w-[28rem]');
    expect(summaryRowSource).toContain('props.expandedContent ?');
    expect(summaryRowSource).toContain('Current');
    expect(summaryRowSource).toContain('Previous');
    expect(summaryRowSource).toContain('Change');
    expect(summaryRowSource).toContain('Organic');
    expect(summaryRowSource).toContain('Sponsored');
    expect(summaryRowSource).not.toContain('Target tier');
    expect(summaryRowSource).not.toContain('Search-term diagnosis');
    expect(toolbarSource).toContain('Trend state');
    expect(toolbarSource).toContain('Sort by');
    expect(toolbarSource).toContain('Ascending');
    expect(toolbarSource).toContain('Adjust columns');
    expect(toolbarSource).toContain('P&L (current)');
    expect(toolbarSource).toContain('ACoS (current)');
    expect(toolbarSource).toContain('Spend (current)');
    expect(toolbarSource).toContain('Sales (current)');
    expect(toolbarSource).toContain('Orders (current)');
    expect(toolbarSource).toContain('Sales rank');
    expect(toolbarSource).toContain('Spend rank');
    expect(toolbarSource).toContain('Impression rank');
    expect(toolbarSource).toContain('Organic rank');
    expect(toolbarSource).toContain('Organic trend');
    expect(toolbarSource).toContain('Reset widths');
    expect(toolbarSource).toContain('Freeze Target column');
    expect(toolbarSource).toContain('Drag header borders to resize columns');
    expect(toolbarSource).toContain('browser&apos;s default for the collapsed table');
    expect(toolbarSource).not.toContain('type="range"');
    expect(toolbarSource).not.toContain('Collapsed table layout');
    expect(toolbarSource).toContain('Select visible stageable');
    expect(toolbarSource).toContain('Handoff selected to Ads Workspace');
    expect(toolbarSource).toContain('Open Ads Workspace');
    expect(expandedPanelSource).toContain('target-inline-panel-');
    expect(expandedPanelSource).toContain('h-[36rem]');
    expect(expandedPanelSource).toContain('grid-rows-[auto_auto_minmax(0,1fr)]');
    expect(expandedPanelSource).toContain('overflow-y-auto');
    expect(expandedPanelSource).toContain('overflow-hidden');
    expect(expandedPanelSource).toContain('border-b-[0.5px]');
    expect(expandedTabsSource).toContain('role="tablist"');
    expect(expandedTabsSource).toContain('role="tab"');
    expect(expandedTabsSource).toContain('overflow-x-auto');
    expect(expandedTabsSource).toContain('aria-selected');
    expect(expandedTabsSource).toContain('aria-controls');
    expect(expandedTabsSource).toContain('target-expanded-tab-');
    expect(expandedTabsSource).toContain('target-expanded-tabpanel-');
    expect(expandedPanelSource).not.toContain('Target detail drawer');
    expect(overrideFormSource).toContain('Save override bundle');
    expect(overrideFormSource).toContain('Replacement action bundle');
  });

  it('renders the tabbed expanded row as a fixed-height shell with one active panel at a time', () => {
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const expandedTabsSource = fs.readFileSync(expandedTabsPath, 'utf-8');
    const expandedStart = shellSource.indexOf('const activeExpandedContent');
    const expandedSource = shellSource.slice(
      expandedStart,
      shellSource.indexOf('\n  return (', expandedStart)
    );
    const normalizedTabsSource = expandedTabsSource.replace(/\s+/g, ' ').trim();

    const orderedTabLabels = [
      "label: 'Why flagged'",
      "label: 'Change plan'",
      "label: 'Search term'",
      "label: 'Placement'",
      "label: 'Metrics'",
      "label: 'Override'",
      "label: 'Advanced'",
    ];
    const indexes = orderedTabLabels.map((label) => expandedTabsSource.indexOf(label));

    indexes.forEach((index, position) => {
      expect(index, `missing tab label ${orderedTabLabels[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < indexes.length; index += 1) {
      expect(indexes[index]).toBeGreaterThan(indexes[index - 1]!);
    }

    expect(normalizedTabsSource).toContain(
      "role=\"tablist\" aria-label=\"Expanded target details\""
    );
    expect(expandedSource).toContain('role="tabpanel"');
    expect(expandedSource).toContain("getTargetExpandedTabPanelId(");
    expect(expandedSource).toContain('switch (activeExpandedTab)');
    expect(expandedSource).toContain("case 'why_flagged'");
    expect(expandedSource).toContain("case 'change_plan'");
    expect(expandedSource).toContain("case 'search_term'");
    expect(expandedSource).toContain("case 'placement'");
    expect(expandedSource).toContain("case 'metrics'");
    expect(expandedSource).toContain("case 'override'");
    expect(expandedSource).toContain("case 'advanced'");
    expect(expandedSource).toContain('Reason codes');
    expect(expandedSource).toContain('No persisted reason codes');
    expect(expandedSource).toContain('Search-term evidence');
    expect(expandedSource).toContain('Campaign-level context only. Placement evidence');
    expect(expandedSource).toContain('<TargetOverrideForm');
    expect(expandedSource).toContain('TargetAdvancedSection');
    expect(expandedSource).toContain("role.currentRole.label} → {activeRow.role.desiredRole.label");
    expect(expandedSource).toContain("`Objective: ${props.productState?.objective ?? 'Not captured'}`");
    expect(expandedSource).toContain('Blocking condition unresolved');
    expect(expandedSource).toContain('Auto-pause eligible');
    expect(expandedSource).not.toContain('Open in Ads Workspace');
    expect(expandedSource).not.toContain('Handoff this target');
    expect(expandedSource).not.toContain('Collapse details');
    expect(expandedSource).not.toContain("activeRow.typeLabel ?? 'Target'");
    expect(expandedSource).not.toContain('activeRow.campaignName ?? activeRow.campaignId');
    expect(expandedSource).not.toContain('Current ${activeRow.role.currentRole.label}');
    expect(expandedSource).not.toContain('Next ${activeRow.role.desiredRole.label}');
    expect(expandedSource).not.toContain('OverrideDisclosureCard');
    expect(expandedSource).not.toContain('SectionDisclosureCard');
    expect(expandedSource).not.toContain("hidden={activeExpandedTab !== 'why_flagged'}");
  });

  it('pulls exact-window run snapshots plus persisted recommendations and role history', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain('export const getAdsOptimizerTargetsViewData');
    expect(source).toContain("runById.status !== 'completed'");
    expect(source).toContain('run.date_start === args.start');
    expect(source).toContain('run.date_end === args.end');
    expect(source).toContain('listAdsOptimizerProductSnapshotsByRun');
    expect(source).toContain('listActiveAdsOptimizerRecommendationOverrides');
    expect(source).toContain('readAdsOptimizerProductRunState');
    expect(source).toContain('listAdsOptimizerTargetSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRecommendationSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRoleTransitionLogsByAsin');
    expect(source).toContain('readAdsOptimizerRecommendationSnapshotView');
    expect(source).toContain('mapTargetSnapshotToProfileView');
    expect(source).toContain('buildAdsOptimizerOverviewComparisonWindow');
    expect(source).toContain('loadAdsOptimizerTargetProfiles');
    expect(source).toContain('mapTargetProfileRowToSnapshotView');
    expect(source).toContain('recommendationsByTargetSnapshotId');
    expect(source).toContain('roleHistoryByTargetId');
    expect(source).toContain('manualOverride');
    expect(source).toContain('previousRowsByKey');
    expect(source).toContain('previousComparable');
    expect(source).toContain('productId');
    expect(source).toContain('requestedRunId');
    expect(source).toContain("resolvedContextSource = 'run_id'");
  });

  it('defines stable collapsed-row layout preferences with column keys and target freeze support', () => {
    const source = fs.readFileSync(tableLayoutPrefsPath, 'utf-8');

    expect(source).toContain('ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY');
    expect(source).toContain("'aph.adsOptimizerTargetsCollapsedTableLayout.v1'");
    expect(source).toContain("key: 'target'");
    expect(source).toContain("key: 'state'");
    expect(source).toContain("key: 'economics'");
    expect(source).toContain("key: 'contribution'");
    expect(source).toContain("key: 'ranking'");
    expect(source).toContain("key: 'role'");
    expect(source).toContain("key: 'change_summary'");
    expect(source).toContain('defaultWidth');
    expect(source).toContain('minWidth');
    expect(source).toContain('maxWidth');
    expect(source).toContain('freezable: true');
    expect(source).toContain('parseAdsOptimizerTargetTableLayoutPrefs');
    expect(source).toContain('serializeAdsOptimizerTargetTableLayoutPrefs');
    expect(source).toContain('toggleAdsOptimizerTargetTableFrozenColumn');
    expect(source).toContain('applyAdsOptimizerTargetTableColumnResizeDelta');
    expect(source).toContain('getAdsOptimizerTargetTableColumnConfig');
  });
});
